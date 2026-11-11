// AksiWarga AI Chatbot — auth-aware, conversation memory across pages
(function () {
    if (window.__aksiwargaChatbot) return;
    window.__aksiwargaChatbot = true;

    // ── Don't show on login page ──
    if (location.pathname.indexOf('login') !== -1) return;

    // ── State ──
    var open = false;
    var user = null;
    var msgs = [];
    var STORAGE_KEY = 'aw_chat_history';

    // ── Restore chat history from sessionStorage ──
    try {
        var saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) msgs = JSON.parse(saved);
    } catch (e) { msgs = []; }

    function saveMsgs() {
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-20))); } catch (e) {}
    }

    function firstName(name) {
        return (name || '').split(/\s+/)[0] || 'Warga';
    }

    // ── CSS ──
    var css = document.createElement('style');
    css.textContent = '\
        @keyframes awSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}\
        @keyframes awFadeIn{from{opacity:0}to{opacity:1}}\
        @keyframes awPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}\
        .aw-btn{position:fixed;bottom:20px;right:20px;z-index:99998;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;font-size:22px;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 15px rgba(124,58,237,.35);transition:transform .2s,box-shadow .2s;background:linear-gradient(135deg,#7c3aed,#a78bfa)}\
        .aw-btn:hover{transform:scale(1.05);box-shadow:0 6px 20px rgba(124,58,237,.5)}\
        .aw-badge{position:absolute;top:-2px;right:-2px;background:#fbbf24;border:2px solid #fff;border-radius:50%;width:12px;height:12px;display:none}\
        .aw-win{position:fixed;bottom:85px;right:20px;z-index:99999;width:360px;max-width:calc(100vw - 40px);height:500px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.18);display:none;flex-direction:column;overflow:hidden;border:1px solid #e9d5ff;animation:awSlideUp .25s ease}\
        .aw-hdr{background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}\
        .aw-hdr-info{display:flex;align-items:center;gap:8px}\
        .aw-hdr-name{font-weight:700;font-size:14px}\
        .aw-hdr-status{font-size:10px;opacity:.85;margin-top:1px}\
        .aw-close{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;opacity:.8;padding:0 4px}\
        .aw-close:hover{opacity:1}\
        .aw-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#faf5ff}\
        .aw-msgs::-webkit-scrollbar{width:4px}\
        .aw-msgs::-webkit-scrollbar-thumb{background:#d8b4fe;border-radius:2px}\
        .aw-bubble{max-width:85%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.5;white-space:pre-wrap;animation:awFadeIn .2s ease}\
        .aw-b-user{background:#7c3aed;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}\
        .aw-b-ai{background:#fff;color:#333;border:1px solid #e9d5ff;align-self:flex-start;border-bottom-left-radius:4px}\
        .aw-typing{background:#fff;color:#999;border:1px solid #e9d5ff;border-radius:12px;border-bottom-left-radius:4px;padding:8px 12px;font-size:13px;align-self:flex-start;animation:awFadeIn .2s}\
        .aw-input-area{padding:8px 12px;background:#fff;border-top:1px solid #ede9fe;flex-shrink:0}\
        .aw-quick{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}\
        .aw-q-btn{background:#f3e8ff;color:#7c3aed;border:1px solid #ddd6fe;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;transition:background .15s}\
        .aw-q-btn:hover{background:#ede9fe}\
        .aw-input-row{display:flex;gap:6px}\
        .aw-input{flex:1;border:1px solid #ddd;border-radius:8px;padding:8px 10px;font-size:13px;outline:none;transition:border-color .15s}\
        .aw-input:focus{border-color:#7c3aed}\
        .aw-send{background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:0 14px;cursor:pointer;font-size:13px;font-weight:600;transition:background .15s}\
        .aw-send:hover{background:#6d28d9}\
        .aw-send:disabled{background:#c4b5fd;cursor:not-allowed}';
    document.head.appendChild(css);

    // ── Build DOM ──
    var btn = document.createElement('button');
    btn.className = 'aw-btn';
    btn.innerHTML = '✦<span class="aw-badge" id="awBadge"></span>';
    btn.title = 'Tanya Asisten AI';

    var win = document.createElement('div');
    win.className = 'aw-win';
    win.innerHTML = '\
        <div class="aw-hdr">\
            <div class="aw-hdr-info">\
                <span style="font-size:18px">✦</span>\
                <div>\
                    <div class="aw-hdr-name">Asisten AksiWarga</div>\
                    <div class="aw-hdr-status" id="awStatus">AI online · siap bantu</div>\
                </div>\
            </div>\
            <button class="aw-close" id="awClose">×</button>\
        </div>\
        <div class="aw-msgs" id="awMsgs"></div>\
        <div class="aw-input-area">\
            <div class="aw-quick" id="awQuick"></div>\
            <div class="aw-input-row">\
                <input class="aw-input" id="awInput" type="text" placeholder="Tulis pertanyaan..." />\
                <button class="aw-send" id="awSend">Kirim</button>\
            </div>\
        </div>';

    // ── Check auth status ──
    fetch('/api/auth/me').then(function (r) { return r.json(); }).then(function (d) {
        user = d.user || null;
        updateStatus();
    }).catch(function () {});

    function updateStatus() {
        var st = document.getElementById('awStatus');
        if (!st) return;
        st.textContent = user ? ('AI online · ' + firstName(user.name)) : 'AI online · mode tamu';
    }

    // ── Chat logic ──
    function toggle() {
        open = !open;
        btn.style.display = open ? 'none' : 'flex';
        win.style.display = open ? 'flex' : 'none';
        if (open) {
            // First time opening — show greeting + quick buttons
            if (msgs.length === 0) {
                var greeting = user
                    ? 'Halo ' + firstName(user.name) + '! 👋\nSaya Asisten AksiWarga. Tanya soal laporan Anda, statistik platform, atau cara melapor.'
                    : 'Halo! Saya Asisten AksiWarga ✦\nBisa bantu jawab soal platform pengaduan warga. Login untuk lihat info laporan pribadi Anda.';
                addMsg('ai', greeting);
                addQuick(user
                    ? ['Berapa laporan saya?', 'Status laporan terbaru', 'Kategori terbanyak?']
                    : ['Apa itu AksiWarga?', 'Cara buat laporan?', 'Berapa total laporan?']);
            }
            var inp = document.getElementById('awInput');
            if (inp) inp.focus();
            scrollBottom();
            var badge = document.getElementById('awBadge');
            if (badge) badge.style.display = 'none';
        }
    }

    function addMsg(role, text) {
        msgs.push({ role: role, text: text });
        saveMsgs();
        renderBubble(role, text);
        scrollBottom();
    }

    function renderBubble(role, text) {
        var el = document.getElementById('awMsgs');
        if (!el) return;
        var d = document.createElement('div');
        d.className = 'aw-bubble ' + (role === 'user' ? 'aw-b-user' : 'aw-b-ai');
        d.textContent = text;
        el.appendChild(d);
    }

    function renderAll() {
        var el = document.getElementById('awMsgs');
        if (!el) return;
        el.innerHTML = '';
        msgs.forEach(function (m) { renderBubble(m.role, m.text); });
    }

    function addTyping() {
        var el = document.getElementById('awMsgs');
        if (!el) return;
        var d = document.createElement('div');
        d.id = 'awTyping';
        d.className = 'aw-typing';
        d.textContent = '✦ mengetik...';
        el.appendChild(d);
        scrollBottom();
    }

    function removeTyping() {
        var t = document.getElementById('awTyping');
        if (t) t.remove();
    }

    function addQuick(items) {
        var q = document.getElementById('awQuick');
        if (!q) return;
        q.innerHTML = '';
        items.forEach(function (item) {
            var b = document.createElement('button');
            b.className = 'aw-q-btn';
            b.textContent = item;
            b.onclick = function () { send(item); };
            q.appendChild(b);
        });
    }

    function scrollBottom() {
        var el = document.getElementById('awMsgs');
        if (el) el.scrollTop = el.scrollHeight;
    }

    function send(text) {
        text = (text || '').trim();
        if (!text) return;
        var inp = document.getElementById('awInput');
        if (inp) inp.value = '';
        var sendBtn = document.getElementById('awSend');
        if (sendBtn) sendBtn.disabled = true;
        addMsg('user', text);
        addTyping();
        document.getElementById('awQuick').innerHTML = '';

        var payload = { question: text };
        if (user && user.email) payload.email = user.email;

        fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function (r) { return r.json(); })
        .then(function (d) {
            removeTyping();
            addMsg('ai', d.answer || d.error || 'Maaf, terjadi kesalahan.');
        })
        .catch(function () {
            removeTyping();
            addMsg('ai', 'Koneksi terputus. Coba lagi ya.');
        })
        .finally(function () {
            if (sendBtn) sendBtn.disabled = false;
        });
    }

    // ── Init ──
    function init() {
        document.body.appendChild(btn);
        document.body.appendChild(win);
        btn.onclick = toggle;
        document.getElementById('awClose').onclick = toggle;
        document.getElementById('awSend').onclick = function () {
            send(document.getElementById('awInput').value);
        };
        document.getElementById('awInput').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); send(e.target.value); }
        });
        // Badge hint if no messages yet
        if (msgs.length === 0) {
            var badge = document.getElementById('awBadge');
            if (badge) badge.style.display = 'block';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
