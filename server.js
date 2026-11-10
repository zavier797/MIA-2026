const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = __dirname;
const STATIC_ROOT = path.join(ROOT, 'react');
const MAP_ROOT = path.join(ROOT, 'map aksiwarga');
const ACCOUNTS_FILE = path.join(ROOT, 'data', 'accounts.json');
const REPORTS_FILE = path.join(ROOT, 'data', 'reports.json');
const BUDGET_FILE = path.join(ROOT, 'data', 'budget.json');
const PORT = process.env.PORT || 3000;
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
    const data = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
    if (!data || !Array.isArray(data.users)) throw new Error('Berkas akun memiliki format yang tidak valid.');
    return data.users;
}

function writeAccounts(users) {
    const tempFile = `${ACCOUNTS_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify({ users }, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tempFile, ACCOUNTS_FILE);
}

function readReports() {
    const data = JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'));
    if (!data || !Array.isArray(data.reports)) throw new Error('Berkas laporan memiliki format yang tidak valid.');
    return data;
}

function writeReports(data) {
    const tempFile = `${REPORTS_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tempFile, REPORTS_FILE);
}

function readBudget() {
    return JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'));
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
            response.writeHead(302, { Location: '/?oauth=success&provider=github' });
            return response.end();
        }
        
        const state = crypto.randomBytes(16).toString('hex');
        oauthState.set(state, { createdAt: Date.now(), provider: 'github' });
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
            response.writeHead(302, { Location: '/' });
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
            response.writeHead(302, { Location: '/?oauth=success&provider=google' });
            return response.end();
        }
        
        const state = crypto.randomBytes(16).toString('hex');
        oauthState.set(state, { createdAt: Date.now(), provider: 'google' });
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
            response.writeHead(302, { Location: '/' });
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
        let filtered = data.reports;
        if (status) filtered = filtered.filter((r) => r.status === status);
        if (category) filtered = filtered.filter((r) => r.category === category);
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
