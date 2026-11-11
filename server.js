const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const Database = require('better-sqlite3');

const ROOT = __dirname;
const STATIC_ROOT = path.join(ROOT, 'react');
const MAP_ROOT = path.join(ROOT, 'map aksiwarga');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DATABASE_FILE = path.join(DATA_DIR, 'aksiwarga.sqlite');
const PORT = Number(process.env.PORT) || 3000;
fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
const db = new Database(DATABASE_FILE);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.exec(fs.readFileSync(path.join(ROOT, 'scripts', 'migrate-json-to-sqlite.sql'), 'utf8'));
const getData = db.prepare('SELECT json FROM app_data WHERE key = ?');
const saveData = db.prepare('INSERT INTO app_data (key, json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json');
const getMeta = db.prepare('SELECT value_json AS json FROM app_meta WHERE key = ?');
const saveMeta = db.prepare('INSERT INTO app_meta (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json');
const importLegacy = db.transaction(() => {
    const count = db.prepare('SELECT count(*) AS count FROM app_data').get().count;
    if (count) return;
    for (const [key, file] of [['accounts', 'accounts.json'], ['reports', 'reports.json'], ['budget', 'budget.json']]) {
        const legacyFile = path.join(DATA_DIR, file);
        if (!fs.existsSync(legacyFile)) throw new Error(`Dataset ${key} tidak ditemukan.`);
        saveData.run(key, fs.readFileSync(legacyFile, 'utf8'));
    }
});
importLegacy();
const saveAccount = db.prepare('INSERT INTO accounts (email, name, password_salt, password_hash, oauth_provider, oauth_id, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?)');
const saveAccountsTransaction = db.transaction((users) => {
    db.exec('DELETE FROM accounts');
    for (const user of users) {
        const { name, email, passwordSalt, passwordHash, oauthProvider = null, oauthId = null, ...extra } = user;
        saveAccount.run(email, name, passwordSalt, passwordHash, oauthProvider, oauthId, JSON.stringify(extra));
    }
});
const saveReport = db.prepare('INSERT INTO reports (id, status, category, province, created_at, payload_json) VALUES (?, ?, ?, ?, ?, ?)');
const saveReportsTransaction = db.transaction((reports) => {
    db.exec('DELETE FROM reports');
    for (const report of reports) saveReport.run(report.id, report.status || null, report.category || null, report.province || null, report.createdAt || null, JSON.stringify(report));
});
const saveProvince = db.prepare('INSERT INTO provinces (id, name, year, payload_json) VALUES (?, ?, ?, ?)');
const saveProvincesTransaction = db.transaction((provinces) => {
    db.exec('DELETE FROM provinces');
    for (const province of provinces) saveProvince.run(province.id, province.name, province.year || null, JSON.stringify(province));
});
const importTables = db.transaction(() => {
    if (db.prepare('SELECT count(*) AS count FROM accounts').get().count) return;
    for (const row of db.prepare('SELECT key, json FROM app_data').all()) {
        if (row.key.endsWith('_meta')) {
            saveMeta.run(row.key.slice(0, -5), row.json);
        }
    }
    const accounts = JSON.parse(getData.get('accounts').json).users;
    const reportData = JSON.parse(getData.get('reports').json);
    const budget = JSON.parse(getData.get('budget').json);
    saveAccountsTransaction(accounts);
    saveReportsTransaction(reportData.reports);
    saveProvincesTransaction(budget.provinces);
    saveMeta.run('reports', JSON.stringify({ nextId: reportData.nextId, total: reportData.total, stats: reportData.stats }));
    saveMeta.run('budget', JSON.stringify(Object.fromEntries(Object.entries(budget).filter(([key]) => key !== 'provinces'))));
});
importTables();
for (const [key, table, file] of [['accounts', 'accounts', 'accounts.json'], ['reports', 'reports', 'reports.json'], ['budget', 'provinces', 'budget.json']]) {
    if (!db.prepare(`SELECT count(*) AS count FROM ${table}`).get().count) throw new Error(`Data ${key} belum termigrasi.`);
}
db.exec('DROP TABLE app_data');
const SESSION_COOKIE = 'aksiwarga_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const sessions = new Map();
const otpStore = new Map(); // email -> {otp, expires, attempts, resetToken}

// OAuth Config
const OAUTH_CALLBACK_URL = process.env.OAUTH_CALLBACK_URL || `http://localhost:${PORT}`;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'demo';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'demo';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'demo';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'demo';
const OAUTH_DEMO_MODE = !process.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET === 'demo';

// AI Gateway config
const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || '';
const AI_GATEWAY_KEY = process.env.AI_GATEWAY_KEY || '';

// Multi-model fallback: fetch all models from gateway, try each until success
let _aiModels = null;
let _aiModelsAt = 0;
async function getAIModels() {
    if (_aiModels && Date.now() - _aiModelsAt < 600000) return _aiModels;
    try {
        const resp = await fetch(`${AI_GATEWAY_URL}/models`, {
            headers: { 'Authorization': `Bearer ${AI_GATEWAY_KEY}` }
        });
        const data = await resp.json();
        _aiModels = (data.data || []).map(m => m.id).filter(Boolean);
        _aiModelsAt = Date.now();
        return _aiModels;
    } catch (e) {
        return _aiModels || [];
    }
}

async function callAI(messages, maxTokens, temperature, minLength) {
    const models = await getAIModels();
    if (!models.length) throw new Error('No AI models available');
    const min = minLength || 5;
    let lastErr;
    for (const model of models) {
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 20000);
            const resp = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${AI_GATEWAY_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, stream: false, max_tokens: maxTokens, temperature, messages }),
                signal: ctrl.signal
            });
            clearTimeout(timer);
            if (!resp.ok) { lastErr = new Error(`${model}: HTTP ${resp.status}`); continue; }
            const data = await resp.json();
            const content = data.choices?.[0]?.message?.content;
            if (content && content.trim().length >= min) return content.trim();
            lastErr = new Error(`${model}: response too short (${content?.trim().length || 0} chars)`);
        } catch (e) {
            lastErr = e;
            continue;
        }
    }
    throw lastErr || new Error('All models failed');
}
const oauthState = new Map(); // CSRF protection
const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
};

function sendJson(response, status, body, headers = {}) {
    response.writeHead(status, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', ...headers });
    response.end(JSON.stringify(body));
}

function readJsonBody(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        let bodyTooLarge = false;
        request.on('data', (chunk) => {
            if (bodyTooLarge) return;
            body += chunk;
            if (Buffer.byteLength(body) > 16 * 1024) {
                bodyTooLarge = true;
                reject(Object.assign(new Error('Permintaan terlalu besar.'), { status: 413 }));
            }
        });
        request.on('end', () => {
            if (bodyTooLarge) return;
            try {
                resolve(JSON.parse(body || '{}'));
            } catch {
                reject(Object.assign(new Error('Format data tidak valid.'), { status: 400 }));
            }
        });
        request.on('error', reject);
    });
}

function readAccounts() {
    return db.prepare('SELECT name, email, password_salt AS passwordSalt, password_hash AS passwordHash, oauth_provider AS oauthProvider, oauth_id AS oauthId, extra_json AS extraJson FROM accounts')
        .all().map(({ extraJson, ...account }) => ({ ...JSON.parse(extraJson), ...Object.fromEntries(Object.entries(account).filter(([, value]) => value !== null)) }));
}

function writeAccounts(users) {
    saveAccountsTransaction(users);
}

function readReports() {
    const meta = JSON.parse(getMeta.get('reports').json);
    const reports = db.prepare('SELECT payload_json FROM reports').all().map((row) => JSON.parse(row.payload_json));
    const maxId = reports.reduce((max, report) => Math.max(max, Number(report.id.match(/(\d+)$/)?.[1]) || 0), 0);
    return { ...meta, reports, nextId: Math.max(Number(meta.nextId) || 1, maxId + 1) };
}

function writeReports(data) {
    db.transaction(() => {
        saveReportsTransaction(data.reports);
        saveMeta.run('reports', JSON.stringify({ nextId: data.nextId, total: data.total, stats: data.stats }));
    })();
}

function readBudget() {
    const meta = JSON.parse(getMeta.get('budget').json);
    return { ...meta, provinces: db.prepare('SELECT payload_json FROM provinces').all().map((row) => JSON.parse(row.payload_json)) };
}

function publicUser(account) {
    return { name: account.name, email: account.email };
}

function setSession(response, account, remember = true) {
    const token = crypto.randomBytes(32).toString('hex');
    const maxAge = remember ? SESSION_TTL_MS : 24 * 60 * 60 * 1000;
    sessions.set(token, { email: account.email, expiresAt: Date.now() + maxAge });
    response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(maxAge / 1000)}`);
}

function sessionUser(request) {
    const cookie = (request.headers.cookie || '').split(';').map((part) => part.trim())
        .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
    if (!cookie) return null;

    const token = cookie.slice(SESSION_COOKIE.length + 1);
    const session = sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
        sessions.delete(token);
        return null;
    }

    const account = readAccounts().find((item) => item.email === session.email);
    return account ? { token, account } : null;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function handleApi(request, response, url) {
    if (request.method === 'GET' && url.pathname === '/api/auth/me') {
        const session = sessionUser(request);
        return sendJson(response, 200, { user: session ? publicUser(session.account) : null });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/register') {
        const body = await readJsonBody(request);
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';

        if (name.length < 3) return sendJson(response, 400, { error: 'Nama lengkap minimal 3 karakter.' });
        if (!isValidEmail(email)) return sendJson(response, 400, { error: 'Masukkan alamat email yang valid.' });
        if (password.length < 8) return sendJson(response, 400, { error: 'Kata sandi minimal 8 karakter.' });

        const users = readAccounts();
        if (users.some((account) => account.email === email)) {
            return sendJson(response, 409, { error: 'Email tersebut sudah terdaftar. Silakan masuk.' });
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
        const account = { name, email, passwordSalt: salt, passwordHash };
        writeAccounts([...users, account]);
        setSession(response, account);
        return sendJson(response, 201, { ok: true, user: publicUser(account) });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
        const body = await readJsonBody(request);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = typeof body.password === 'string' ? body.password : '';
        const account = readAccounts().find((item) => item.email === email);
        const candidateHash = account
            ? crypto.pbkdf2Sync(password, account.passwordSalt, 120000, 32, 'sha256')
            : Buffer.alloc(32);
        const storedHash = account ? Buffer.from(account.passwordHash, 'hex') : Buffer.alloc(32);
        const passwordMatches = crypto.timingSafeEqual(candidateHash, storedHash);

        if (!account || !passwordMatches) {
            return sendJson(response, 401, { error: 'Email atau kata sandi salah. Periksa kembali lalu coba lagi.' });
        }

        setSession(response, account, body.remember !== false);
        return sendJson(response, 200, { ok: true, user: publicUser(account) });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
        const session = sessionUser(request);
        if (session) sessions.delete(session.token);
        response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
        return sendJson(response, 200, { ok: true });
    }

    // Update profile (name, phone, password)
    if (request.method === 'POST' && url.pathname === '/api/auth/update-profile') {
        const session = sessionUser(request);
        if (!session) return sendJson(response, 401, { error: 'Tidak ada sesi aktif.' });
        let body;
        try { body = await readJsonBody(request); }
        catch (err) { return sendJson(response, err.status || 400, { error: err.message || 'Format JSON tidak valid.' }); }

        const users = readAccounts();
        const idx = users.findIndex(u => u.email === session.account.email);
        if (idx === -1) return sendJson(response, 404, { error: 'Akun tidak ditemukan.' });

        if (body.name && body.name.trim()) users[idx].name = body.name.trim();
        if (body.phone) users[idx].phone = body.phone.trim();
        if (body.password && body.password.length >= 6) {
            const salt = users[idx].passwordSalt || crypto.randomBytes(16).toString('hex');
            users[idx].passwordSalt = salt;
            users[idx].passwordHash = crypto.pbkdf2Sync(body.password, salt, 120000, 32, 'sha256').toString('hex');
        }

        writeAccounts(users);
        return sendJson(response, 200, { ok: true, user: publicUser(users[idx]) });
    }

    // OAuth: GitHub Login
    if (request.method === 'GET' && url.pathname === '/api/auth/github') {
        if (OAUTH_DEMO_MODE) {
            // Demo mode: auto-create account tanpa real GitHub OAuth
            const demoEmail = `github.demo.${Date.now()}@aksiwarga.com`;
            const users = readAccounts();
            const salt = crypto.randomBytes(16).toString('hex');
            const randomPassword = crypto.randomBytes(32).toString('hex');
            const passwordHash = crypto.pbkdf2Sync(randomPassword, salt, 120000, 32, 'sha256').toString('hex');
            const account = {
                name: 'GitHub Demo User',
                email: demoEmail,
                passwordSalt: salt,
                passwordHash,
                oauthProvider: 'github-demo',
                oauthId: 'demo-' + Date.now()
            };
            writeAccounts([...users, account]);
            setSession(response, account);
            const redirectTo = url.searchParams.get('redirect') || '/';
            response.writeHead(302, { Location: redirectTo + (redirectTo.includes('?') ? '&' : '?') + 'oauth=success&provider=github' });
            return response.end();
        }
        
        const state = crypto.randomBytes(16).toString('hex');
        oauthState.set(state, { createdAt: Date.now(), provider: 'github', redirect: url.searchParams.get('redirect') });
        const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(OAUTH_CALLBACK_URL + '/api/auth/github/callback')}&state=${state}&scope=user:email`;
        response.writeHead(302, { Location: redirectUrl });
        return response.end();
    }

    // OAuth: GitHub Callback
    if (request.method === 'GET' && url.pathname === '/api/auth/github/callback') {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        
        if (!oauthState.has(state)) {
            response.writeHead(302, { Location: '/login.html?error=invalid_state' });
            return response.end();
        }
        const stateData = oauthState.get(state);
        oauthState.delete(state);

        try {
            // Exchange code for token
            const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    client_id: GITHUB_CLIENT_ID,
                    client_secret: GITHUB_CLIENT_SECRET,
                    code,
                    redirect_uri: OAUTH_CALLBACK_URL + '/api/auth/github/callback'
                })
            });
            const tokenData = await tokenResp.json();
            
            if (!tokenData.access_token) {
                response.writeHead(302, { Location: '/login.html?error=token_failed' });
                return response.end();
            }

            // Fetch user profile
            const userResp = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
            });
            const userData = await userResp.json();

            // Fetch primary email
            const emailResp = await fetch('https://api.github.com/user/emails', {
                headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
            });
            const emails = await emailResp.json();
            const primaryEmail = emails.find(e => e.primary)?.email || userData.email;

            if (!primaryEmail) {
                response.writeHead(302, { Location: '/login.html?error=no_email' });
                return response.end();
            }

            // Find or create account
            const users = readAccounts();
            let account = users.find(u => u.email === primaryEmail.toLowerCase());
            
            if (!account) {
                // Create new account with OAuth
                const salt = crypto.randomBytes(16).toString('hex');
                const randomPassword = crypto.randomBytes(32).toString('hex');
                const passwordHash = crypto.pbkdf2Sync(randomPassword, salt, 120000, 32, 'sha256').toString('hex');
                account = {
                    name: userData.name || userData.login,
                    email: primaryEmail.toLowerCase(),
                    passwordSalt: salt,
                    passwordHash,
                    oauthProvider: 'github',
                    oauthId: userData.id.toString()
                };
                writeAccounts([...users, account]);
            }

            setSession(response, account);
            const redirectTo = stateData?.redirect || '/';
            response.writeHead(302, { Location: redirectTo });
            return response.end();
        } catch (error) {
            response.writeHead(302, { Location: '/login.html?error=oauth_failed' });
            return response.end();
        }
    }

    // OAuth: Google Login
    if (request.method === 'GET' && url.pathname === '/api/auth/google') {
        if (OAUTH_DEMO_MODE) {
            // Demo mode: auto-create account tanpa real Google OAuth
            const demoEmail = `google.demo.${Date.now()}@aksiwarga.com`;
            const users = readAccounts();
            const salt = crypto.randomBytes(16).toString('hex');
            const randomPassword = crypto.randomBytes(32).toString('hex');
            const passwordHash = crypto.pbkdf2Sync(randomPassword, salt, 120000, 32, 'sha256').toString('hex');
            const account = {
                name: 'Google Demo User',
                email: demoEmail,
                passwordSalt: salt,
                passwordHash,
                oauthProvider: 'google-demo',
                oauthId: 'demo-' + Date.now()
            };
            writeAccounts([...users, account]);
            setSession(response, account);
            const redirectTo = url.searchParams.get('redirect') || '/';
            response.writeHead(302, { Location: redirectTo + (redirectTo.includes('?') ? '&' : '?') + 'oauth=success&provider=google' });
            return response.end();
        }
        
        const state = crypto.randomBytes(16).toString('hex');
        oauthState.set(state, { createdAt: Date.now(), provider: 'google', redirect: url.searchParams.get('redirect') });
        const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(OAUTH_CALLBACK_URL + '/api/auth/google/callback')}&response_type=code&scope=email%20profile&state=${state}`;
        response.writeHead(302, { Location: redirectUrl });
        return response.end();
    }

    // OAuth: Google Callback
    if (request.method === 'GET' && url.pathname === '/api/auth/google/callback') {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        
        if (!oauthState.has(state)) {
            response.writeHead(302, { Location: '/login.html?error=invalid_state' });
            return response.end();
        }
        const stateData = oauthState.get(state);
        oauthState.delete(state);

        try {
            // Exchange code for token
            const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: GOOGLE_CLIENT_ID,
                    client_secret: GOOGLE_CLIENT_SECRET,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: OAUTH_CALLBACK_URL + '/api/auth/google/callback'
                })
            });
            const tokenData = await tokenResp.json();
            
            if (!tokenData.access_token) {
                response.writeHead(302, { Location: '/login.html?error=token_failed' });
                return response.end();
            }

            // Fetch user profile
            const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
            });
            const userData = await userResp.json();

            if (!userData.email) {
                response.writeHead(302, { Location: '/login.html?error=no_email' });
                return response.end();
            }

            // Find or create account
            const users = readAccounts();
            let account = users.find(u => u.email === userData.email.toLowerCase());
            
            if (!account) {
                const salt = crypto.randomBytes(16).toString('hex');
                const randomPassword = crypto.randomBytes(32).toString('hex');
                const passwordHash = crypto.pbkdf2Sync(randomPassword, salt, 120000, 32, 'sha256').toString('hex');
                account = {
                    name: userData.name,
                    email: userData.email.toLowerCase(),
                    passwordSalt: salt,
                    passwordHash,
                    oauthProvider: 'google',
                    oauthId: userData.id
                };
                writeAccounts([...users, account]);
            }

            setSession(response, account);
            const redirectTo = stateData?.redirect || '/';
            response.writeHead(302, { Location: redirectTo });
            return response.end();
        } catch (error) {
            response.writeHead(302, { Location: '/login.html?error=oauth_failed' });
            return response.end();
        }
    }

    // OAuth: Facebook Login (Demo mode only - Facebook OAuth requires business verification)
    if (request.method === 'GET' && url.pathname === '/api/auth/facebook') {
        const demoEmail = `facebook.demo.${Date.now()}@aksiwarga.com`;
        const users = readAccounts();
        const salt = crypto.randomBytes(16).toString('hex');
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const passwordHash = crypto.pbkdf2Sync(randomPassword, salt, 120000, 32, 'sha256').toString('hex');
        const account = {
            name: 'Facebook Demo User',
            email: demoEmail,
            passwordSalt: salt,
            passwordHash,
            oauthProvider: 'facebook-demo',
            oauthId: 'demo-' + Date.now()
        };
        writeAccounts([...users, account]);
        setSession(response, account);
        response.writeHead(302, { Location: '/?oauth=success&provider=facebook' });
        return response.end();
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/forgot-password') {
        const body = await readJsonBody(request);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (!isValidEmail(email)) return sendJson(response, 400, { error: 'Email tidak valid.' });

        const account = readAccounts().find((u) => u.email === email);
        if (!account) return sendJson(response, 404, { error: 'Email tidak terdaftar.' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = Date.now() + 10 * 60 * 1000; // 10 menit
        otpStore.set(email, { otp, expires, attempts: 0 });

        console.log(`\n[OTP] Email: ${email} | Kode: ${otp} | Expires: ${new Date(expires).toLocaleString('id-ID')}\n`);

        return sendJson(response, 200, {
            message: 'Kode OTP telah dikirim ke email Anda.',
            email,
            _dev_otp: otp, // DEV ONLY - hapus di production
        });
    }

    // Verify OTP
    if (request.method === 'POST' && url.pathname === '/api/auth/verify-otp') {
        const body = await readJsonBody(request);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const otp = typeof body.otp === 'string' ? body.otp.trim() : '';
        const stored = otpStore.get(email);

        if (!stored) return sendJson(response, 400, { error: 'OTP tidak ditemukan atau sudah expired.' });
        if (Date.now() > stored.expires) {
            otpStore.delete(email);
            return sendJson(response, 400, { error: 'OTP sudah kadaluarsa. Minta kode baru.' });
        }
        if (stored.attempts >= 3) {
            otpStore.delete(email);
            return sendJson(response, 429, { error: 'Terlalu banyak percobaan salah.' });
        }
        if (stored.otp !== otp) {
            stored.attempts++;
            return sendJson(response, 400, { error: 'Kode OTP salah.', remaining: 3 - stored.attempts });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        stored.resetToken = resetToken;
        stored.resetExpires = Date.now() + 30 * 60 * 1000; // 30 menit

        return sendJson(response, 200, { message: 'OTP valid.', resetToken });
    }

    // Reset Password
    if (request.method === 'POST' && url.pathname === '/api/auth/reset-password') {
        const body = await readJsonBody(request);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const resetToken = typeof body.resetToken === 'string' ? body.resetToken : '';
        const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
        const stored = otpStore.get(email);

        if (!stored || stored.resetToken !== resetToken) {
            return sendJson(response, 400, { error: 'Token reset tidak valid.' });
        }
        if (Date.now() > stored.resetExpires) {
            otpStore.delete(email);
            return sendJson(response, 400, { error: 'Token reset sudah kadaluarsa.' });
        }
        if (newPassword.length < 8) {
            return sendJson(response, 400, { error: 'Password minimal 8 karakter.' });
        }

        const users = readAccounts();
        const userIndex = users.findIndex((u) => u.email === email);
        if (userIndex === -1) return sendJson(response, 404, { error: 'User tidak ditemukan.' });

        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = crypto.pbkdf2Sync(newPassword, salt, 120000, 32, 'sha256').toString('hex');
        users[userIndex].passwordSalt = salt;
        users[userIndex].passwordHash = passwordHash;
        writeAccounts(users);

        otpStore.delete(email);
        return sendJson(response, 200, { message: 'Password berhasil direset. Silakan login.' });
    }

    if (request.method === 'GET' && url.pathname === '/api/reports') {
        const data = readReports();
        const status = url.searchParams.get('status');
        const category = url.searchParams.get('category');
        const reporterEmail = url.searchParams.get('reporterEmail');
        let filtered = data.reports;
        if (status) filtered = filtered.filter((r) => r.status === status);
        if (category) filtered = filtered.filter((r) => r.category === category);
        if (reporterEmail) filtered = filtered.filter((r) => r.reporterEmail && r.reporterEmail.toLowerCase() === reporterEmail.toLowerCase());
        return sendJson(response, 200, { reports: filtered, total: filtered.length });
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/reports/')) {
        const id = url.pathname.slice('/api/reports/'.length);
        const data = readReports();
        const report = data.reports.find((r) => r.id === id || r.id === `TW-2026-${id}` || r.id === id.toUpperCase());
        if (!report) return sendJson(response, 404, { error: 'Laporan tidak ditemukan.' });
        return sendJson(response, 200, { report });
    }

    if (request.method === 'POST' && url.pathname === '/api/reports') {
        const body = await readJsonBody(request);
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        const category = typeof body.category === 'string' ? body.category.trim() : '';
        const description = typeof body.description === 'string' ? body.description.trim() : '';
        const location = typeof body.location === 'string' ? body.location.trim() : '';
        const province = typeof body.province === 'string' ? body.province.trim() : '';
        const reporterName = typeof body.reporterName === 'string' ? body.reporterName.trim() : '';
        const reporterEmail = typeof body.reporterEmail === 'string' ? body.reporterEmail.trim() : '';
        const reporterPhone = typeof body.reporterPhone === 'string' ? body.reporterPhone.trim() : '';

        if (title.length < 10) return sendJson(response, 400, { error: 'Judul laporan minimal 10 karakter.' });
        if (!category) return sendJson(response, 400, { error: 'Kategori harus dipilih.' });
        if (description.length < 20) return sendJson(response, 400, { error: 'Deskripsi minimal 20 karakter.' });
        if (!location) return sendJson(response, 400, { error: 'Lokasi harus diisi.' });
        if (!reporterName) return sendJson(response, 400, { error: 'Nama pelapor harus diisi.' });

        const data = readReports();
        const newId = `TW-2026-${String(data.nextId).padStart(4, '0')}`;
        const categoryMap = {
            'Infrastruktur Jalan': 'Dinas Bina Marga',
            'Penerangan Jalan': 'Dinas PUPR',
            'Kebersihan & Sanitasi': 'Dinas Lingkungan Hidup',
            'Drainase & Banjir': 'Dinas Sumber Daya Air',
            'Keamanan Lingkungan': 'Dinas Kehutanan'
        };
        const agency = categoryMap[category] || 'Dinas Terkait';
        const slaHours = category === 'Keamanan Lingkungan' ? 12 : 168;
        const createdAt = new Date().toISOString();
        const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString();

        const newReport = {
            id: newId,
            title,
            category,
            description,
            location,
            province: province || 'DKI Jakarta',
            agency,
            status: 'pending',
            priority: 'medium',
            reporterName,
            reporterEmail,
            reporterPhone,
            photoUrl: body.photoUrl || null,
            createdAt,
            slaDeadline,
            budget: null,
            estimatedCost: null,
            logs: [{
                timestamp: createdAt,
                actor: 'Sistem',
                message: 'Laporan diterima dan terdaftar. Menunggu verifikasi dinas terkait.'
            }]
        };

        data.reports.unshift(newReport);
        data.nextId += 1;
        writeReports(data);
        return sendJson(response, 201, { ok: true, report: newReport });
    }

    if (request.method === 'GET' && url.pathname === '/api/budget') {
        const budget = readBudget();
        const province = url.searchParams.get('province');
        if (province) {
            const prov = budget.provinces.find((p) => p.id === province || p.name === province);
            if (!prov) return sendJson(response, 404, { error: 'Provinsi tidak ditemukan.' });
            return sendJson(response, 200, { province: prov });
        }
        return sendJson(response, 200, budget);
    }

    // ─── AI Endpoints ───

    // AI: Auto-categorize complaint
    if (request.method === 'POST' && url.pathname === '/api/ai/categorize') {
        const body = await readJsonBody(request);
        const description = typeof body.description === 'string' ? body.description.trim().slice(0, 2000) : '';
        if (!description) return sendJson(response, 400, { error: 'Deskripsi harus diisi.' });
        if (!AI_GATEWAY_URL) return sendJson(response, 503, { error: 'AI gateway tidak dikonfigurasi.' });

        const categories = ['Infrastruktur Jalan', 'Kebersihan & Sanitasi', 'Penerangan Jalan', 'Keamanan Lingkungan', 'Drainase & Banjir'];
        const agencyMap = {
            'Infrastruktur Jalan': 'Dinas Bina Marga',
            'Kebersihan & Sanitasi': 'Dinas Lingkungan Hidup',
            'Penerangan Jalan': 'Dinas Perumahan dan Permukiman',
            'Keamanan Lingkungan': 'Dinas Ketenteraman dan Ketertiban',
            'Drainase & Banjir': 'Dinas Sumber Daya Air'
        };

        try {
            const content = await callAI([{
                role: 'user',
                content: `Anda adalah sistem klasifikasi pengaduan warga Indonesia. Analisis pengaduan berikut dan berikan response JSON ONLY (tanpa markdown).\n\nPilihan kategori: ${categories.join(', ')}\n\nPilihan prioritas: low, medium, high, urgent\n\nAturan prioritas:\n- urgent: mengancam nyawa/keselamatan (gas bocor, struktur bangunan rapuh, kebakaran)\n- high: dampak luas atau bahaya signifikan (jalan rusak parah, banjir bandang)\n- medium: dampak sedang (lampu mati, sampah menumpuk)\n- low: gangguan minor (trotoar retak rambat pudar)\n\nPengaduan: "${description}"\n\nJawab dengan format JSON: {"category": "nama kategori", "priority": "level", "reason": "alasan singkat dalam Bahasa Indonesia"}`
            }], 150, 0.1);
            // Strip markdown code fences if present
            const cleanContent = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleanContent);

            const category = categories.includes(parsed.category) ? parsed.category : categories[0];
            const validPriorities = ['low', 'medium', 'high', 'urgent'];
            const priority = validPriorities.includes(parsed.priority) ? parsed.priority : 'medium';

            return sendJson(response, 200, {
                category,
                priority,
                agency: agencyMap[category] || 'Dinas Terkait',
                reason: parsed.reason || '',
                aiPowered: true
            });
        } catch (err) {
            return sendJson(response, 500, { error: 'AI gagal memproses. Coba lagi.', detail: err.message });
        }
    }

    // AI: Generate dashboard insights from report statistics
    if (request.method === 'GET' && url.pathname === '/api/ai/insights') {
        if (!AI_GATEWAY_URL) return sendJson(response, 503, { error: 'AI gateway tidak dikonfigurasi.' });

        const data = readReports();
        const reports = data.reports;
        const total = reports.length;
        const byCategory = {};
        const byStatus = {};
        const byProvince = {};
        for (const r of reports) {
            byCategory[r.category] = (byCategory[r.category] || 0) + 1;
            byStatus[r.status] = (byStatus[r.status] || 0) + 1;
            byProvince[r.province] = (byProvince[r.province] || 0) + 1;
        }
        const stats = {
            total,
            byCategory,
            byStatus,
            byProvince,
            topCategories: Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5),
            topProvinces: Object.entries(byProvince).sort((a, b) => b[1] - a[1]).slice(0, 3)
        };

        try {
            const insight = await callAI([{
                role: 'user',
                content: `Anda adalah analis data publik Indonesia. Buat insight singkat (maks 3 kalimat) dari statistik pengaduan warga berikut. Gunakan Bahasa Indonesia, tone profesional tapi mudah dipahami warga.\n\nStatistik:\n- Total laporan: ${stats.total}\n- Kategori terbanyak: ${stats.topCategories.map(([k, v]) => `${k} (${v})`).join(', ')}\n- Provinsi terbanyak: ${stats.topProvinces.map(([k, v]) => `${k} (${v})`).join(', ')}\n- Status: ${Object.entries(stats.byStatus).map(([k, v]) => `${k}=${v}`).join(', ')}\n\nBeri 2-3 insight actionable: tren, area prioritas, atau rekomendasi singkat. JANGAN gunakan markdown atau bullet points. Tulis sebagai paragraf biasa.`
            }], 500, 0.3, 80);

            return sendJson(response, 200, { insight, stats: { total, topCategories: stats.topCategories, topProvinces: stats.topProvinces, byStatus }, aiPowered: true });
        } catch (err) {
            return sendJson(response, 500, { error: 'AI gagal membuat insight.', detail: err.message });
        }
    }

    // AI: Chatbot asisten virtual
    if (request.method === 'POST' && url.pathname === '/api/ai/chat') {
        const body = await readJsonBody(request);
        const question = typeof body.question === 'string' ? body.question.trim().slice(0, 500) : '';
        const email = typeof body.email === 'string' ? body.email.trim() : '';
        if (!question) return sendJson(response, 400, { error: 'Pertanyaan harus diisi.' });
        if (!AI_GATEWAY_URL) return sendJson(response, 503, { error: 'AI tidak tersedia.' });

        const data = readReports();
        const reports = data.reports;
        const byCategory = {}, byStatus = {}, byProvince = {};
        for (const r of reports) {
            byCategory[r.category] = (byCategory[r.category] || 0) + 1;
            byStatus[r.status] = (byStatus[r.status] || 0) + 1;
            byProvince[r.province] = (byProvince[r.province] || 0) + 1;
        }
        const recent = reports.slice(-5).reverse().map(r =>
            `- ${r.title} (${r.category}, ${r.status}, ${r.province})`).join('\n');

        // If user is logged in, include their personal report data
        let userContext = '';
        let userName = 'Warga';
        if (email) {
            const userReports = reports.filter(r =>
                r.reporterEmail && r.reporterEmail.toLowerCase() === email.toLowerCase());
            if (userReports.length > 0) {
                const userByStatus = {};
                userReports.forEach(r => { userByStatus[r.status] = (userByStatus[r.status] || 0) + 1; });
                const userRecent = userReports.slice(-3).reverse().map(r =>
                    `- ${r.title} (${r.category}, ${r.status})`).join('\n');
                userContext = `\n\nData laporan user ini (${email}):\n- Total: ${userReports.length}\n- Status: ${Object.entries(userByStatus).map(([k,v]) => `${k}=${v}`).join(', ')}\n- Laporan terbaru:\n${userRecent}`;
            } else {
                userContext = `\n\nUser ini (${email}) belum punya laporan sama sekali.`;
            }
        }

        const context = `Anda adalah Asisten AksiWarga, bot virtual platform pengaduan warga Indonesia. Jawab pertanyaan ${email ? 'warga yang sudah login' : 'pengunjung'} dengan ramah, singkat, dan akurat dalam Bahasa Indonesia.${email ? ' Panggil dengan ramah.' : ''}

Data laporan platform saat ini:
- Total: ${reports.length} laporan
- Status: ${Object.entries(byStatus).map(([k,v]) => `${k}=${v}`).join(', ')}
- Kategori: ${Object.entries(byCategory).map(([k,v]) => `${k}=${v}`).join(', ')}
- Provinsi: ${Object.entries(byProvince).map(([k,v]) => `${k}=${v}`).join(', ')}

Laporan terbaru:
${recent}${userContext}

Pertanyaan: "${question}"

Jawab MAX 3 kalimat, ramah, faktual. Jika user belum login dan bertanya soal laporan pribadi, sarankan login dulu. Jika di luar topik pengaduan/AksiWarga, arahkan kembali.`;

        try {
            const answer = await callAI([{ role: 'user', content: context }], 200, 0.3);
            return sendJson(response, 200, { answer, aiPowered: true });
        } catch (err) {
            return sendJson(response, 500, { error: 'AI tidak merespons.' });
        }
    }

    // AI: Personalized user summary
    if (request.method === 'GET' && url.pathname === '/api/ai/user-summary') {
        const email = url.searchParams.get('email');
        if (!email) return sendJson(response, 400, { error: 'Email diperlukan.' });
        if (!AI_GATEWAY_URL) return sendJson(response, 503, { error: 'AI tidak tersedia.' });

        const data = readReports();
        const userReports = data.reports.filter(r =>
            r.reporterEmail && r.reporterEmail.toLowerCase() === email.toLowerCase());

        if (userReports.length === 0) return sendJson(response, 200, { summary: 'Belum ada laporan. Mulai buat pengaduan pertama Anda!', aiPowered: false });

        const byCat = {}, byStatus = {};
        for (const r of userReports) {
            byCat[r.category] = (byCat[r.category] || 0) + 1;
            byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        }
        const recentTitles = userReports.slice(-3).reverse().map(r => `- ${r.title} (${r.status})`).join('\n');

        const context = `Anda adalah asisten AksiWarga. Buat ringkasan aktivitas pengaduan warga dalam Bahasa Indonesia, ramah dan personal (maks 3 kalimat).

Data laporan warga ini:
- Total laporan: ${userReports.length}
- Kategori: ${Object.entries(byCat).map(([k,v]) => `${k}=${v}`).join(', ')}
- Status: ${Object.entries(byStatus).map(([k,v]) => `${k}=${v}`).join(', ')}
- Laporan terbaru:
${recentTitles}

Beri ringkasan aktivitas + 1 saran atau semangat. Jangan pakai markdown.`;

        try {
            const summary = await callAI([{ role: 'user', content: context }], 200, 0.5);
            return sendJson(response, 200, { summary, aiPowered: true });
        } catch (err) {
            return sendJson(response, 500, { error: 'AI gagal membuat ringkasan.' });
        }
    }

    // AI: Duplicate detection
    if (request.method === 'POST' && url.pathname === '/api/ai/duplicate-check') {
        const body = await readJsonBody(request);
        const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '';
        const location = typeof body.location === 'string' ? body.location.trim().slice(0, 200) : '';
        if (!description) return sendJson(response, 400, { error: 'Deskripsi diperlukan.' });
        if (!AI_GATEWAY_URL) return sendJson(response, 200, { duplicate: false, aiPowered: false });

        const data = readReports();
        // Get recent reports with same location or similar category
        const candidates = data.reports
            .filter(r => r.location && location &&
                r.location.toLowerCase().includes(location.toLowerCase().split(',')[0]) ||
                (r.province && location.toLowerCase().includes(r.province.toLowerCase())))
            .slice(-10)
            .map(r => `ID ${r.id}: ${r.title} — ${r.description?.slice(0, 100)} (${r.status})`)
            .join('\n');

        if (!candidates) return sendJson(response, 200, { duplicate: false, aiPowered: true, message: 'Tidak ada laporan serupa.' });

        const context = `Bandingkan pengaduan baru dengan laporan yang sudah ada. Apakah ada yang sangat mirip (duplikat)?

Pengaduan baru: "${description}" (lokasi: ${location || 'tidak disebutkan'})

Laporan yang sudah ada:
${candidates}

Jawab JSON: {"isDuplicate": true/false, "similarId": "ID atau null", "reason": "alasan singkat"}`;

        try {
            const content = await callAI([{ role: 'user', content: context }], 100, 0.1);
            const cleanContent = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            const parsed = JSON.parse(cleanContent);
            return sendJson(response, 200, {
                duplicate: !!parsed.isDuplicate,
                similarId: parsed.similarId || null,
                reason: parsed.reason || '',
                aiPowered: true
            });
        } catch (err) {
            return sendJson(response, 200, { duplicate: false, aiPowered: true, message: 'Cek duplikat dilewati.' });
        }
    }

    return sendJson(response, 404, { error: 'Endpoint tidak ditemukan.' });
}

function serveStatic(request, response, url) {
    let pathname;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        response.writeHead(400);
        response.end('URL tidak valid.');
        return;
    }

    const mapPrefix = '/map aksiwarga';
    const isAsset = pathname.startsWith('/asset/');
    const isMap = pathname === mapPrefix || pathname.startsWith(`${mapPrefix}/`);
    const basePath = isAsset ? path.join(ROOT, 'asset') : isMap ? MAP_ROOT : STATIC_ROOT;
    const requestedPath = isAsset
        ? pathname.slice('/asset/'.length)
        : isMap
            ? pathname.slice(mapPrefix.length).replace(/^[/\\]+/, '') || 'index.html'
            : pathname === '/' ? 'index.html' : pathname.replace(/^[/\\]+/, '');
    let filePath = path.resolve(basePath, requestedPath);
    if (filePath !== basePath && !filePath.startsWith(`${basePath}${path.sep}`)) {
        response.writeHead(403);
        response.end('Akses ditolak.');
        return;
    }

    if (!path.extname(filePath) && !fs.existsSync(filePath)) filePath = path.join(STATIC_ROOT, 'index.html');
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        response.writeHead(404);
        response.end('Halaman tidak ditemukan.');
        return;
    }

    response.writeHead(200, {
        'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    });
    fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
        try {
            await handleApi(request, response, url);
        } catch (error) {
            if (response.headersSent || response.destroyed) return;
            const status = Number.isInteger(error.status) ? error.status : 500;
            if (status >= 500) console.error('Kesalahan API:', error);
            sendJson(response, status, { error: status === 500 ? 'Terjadi kesalahan server.' : error.message });
        }
        return;
    }
    serveStatic(request, response, url);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`AksiWarga berjalan di http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
