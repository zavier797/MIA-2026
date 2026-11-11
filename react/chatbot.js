// AksiWarga AI Chatbot Widget — self-contained, load on any page
(function () {
    if (window.__aksiwargaChatbot) return;
    window.__aksiwargaChatbot = true;

    var open = false;
    var messages = [];

    // Button
    var btn = document.createElement('button');
    btn.id = 'aiChatBtn';
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;width:56px;height:56px;border-radius:50%;border:none;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;box-shadow:0 4px 15px rgba(124,58,237,.4);cursor:pointer;font-size:22px;display:flex;align-items:center;justify-content:center;transition:transform .2s';
    btn.innerHTML = '✦';
    btn.title = 'Tanya Asisten AI';
    btn.onclick = toggle;

    // Window
    var win = document.createElement('div');
    win.id = 'aiChatWin';
    win.style.cssText = 'position:fixed;bottom:85px;right:20px;z-index:9999;width:340px;max-width:calc(100vw - 40px);height:480px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.15);display:none;flex-direction:column;overflow:hidden;border:1px solid #e9d5ff';

    win.innerHTML = '\
        <div style="background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between">\
            <div style="display:flex;align-items:center;gap:8px">\
                <span style="font-size:16px">✦</span>\
                <span style="font-weight:700;font-size:14px">Asisten AksiWarga</span>\
            </div>\
            <button id="aiChatClose" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;opacity:.8">×</button>\
        </div>\
        <div id="aiChatMsgs" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#faf5ff"></div>\
        <div style="padding:8px 12px;background:#fff;border-top:1px solid #ede9fe">\
            <div id="aiChatQuick" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px"></div>\
            <div style="display:flex;gap:6px">\
                <input id="aiChatInput" type="text" placeholder="Tulis pertanyaan..." style="flex:1;border:1px solid #ddd;border-radius:8px;padding:8px 10px;font-size:13px;outline:none" />\
                <button id="aiChatSend" style="background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:0 12px;cursor:pointer;font-size:13px;font-weight:600">Kirim</button>\
            </div>\
        </div>';

    function toggle() {
        open = !open;
        btn.style.display = open ? 'none' : 'flex';
        win.style.display = open ? 'flex' : 'none';
        if (open && messages.length === 0) {
            addMsg('ai', 'Halo! Saya Asisten AksiWarga ✦\nTanya apa aja soal laporan warga, kategori, atau cara melapor.');
            addQuick(['Berapa total laporan?', 'Kategori terbanyak?', 'Cara buat laporan?']);
            document.getElementById('aiChatInput').focus();
        }
        if (open) scrollBottom();
    }

    function addMsg(role, text) {
        var msgs = document.getElementById('aiChatMsgs');
        if (!msgs) return;
        var div = document.createElement('div');
        div.style.cssText = 'max-width:85%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.5;white-space:pre-wrap;' +
            (role === 'user' ? 'background:#7c3aed;color:#fff;align-self:flex-end;border-bottom-right-radius:4px' : 'background:#fff;color:#333;border:1px solid #e9d5ff;align-self:flex-start;border-bottom-left-radius:4px');
        div.textContent = text;
        msgs.appendChild(div);
        messages.push({ role: role, text: text });
        scrollBottom();
    }

    function addTyping() {
        var msgs = document.getElementById('aiChatMsgs');
        var div = document.createElement('div');
        div.id = 'aiChatTyping';
        div.style.cssText = 'background:#fff;color:#999;border:1px solid #e9d5ff;border-radius:12px;padding:8px 12px;font-size:13px;align-self:flex-start;border-bottom-left-radius:4px';
        div.textContent = '✦ mengetik...';
        msgs.appendChild(div);
        scrollBottom();
    }

    function removeTyping() {
        var t = document.getElementById('aiChatTyping');
        if (t) t.remove();
    }

    function addQuick(items) {
        var q = document.getElementById('aiChatQuick');
        if (!q) return;
        q.innerHTML = '';
        items.forEach(function (item) {
            var b = document.createElement('button');
            b.textContent = item;
            b.style.cssText = 'background:#f3e8ff;color:#7c3aed;border:1px solid #ddd6fe;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer';
            b.onclick = function () { send(item); };
            q.appendChild(b);
        });
    }

    function scrollBottom() {
        var msgs = document.getElementById('aiChatMsgs');
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }

    function send(text) {
        text = (text || '').trim();
        if (!text) return;
        var input = document.getElementById('aiChatInput');
        if (input) input.value = '';
        addMsg('user', text);
        addTyping();
        document.getElementById('aiChatQuick').innerHTML = '';
        fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: text })
        })
        .then(function (r) { return r.json(); })
        .then(function (d) {
            removeTyping();
            addMsg('ai', d.answer || d.error || 'Maaf, terjadi kesalahan.');
        })
        .catch(function () {
            removeTyping();
            addMsg('ai', 'Koneksi terputus. Coba lagi.');
        });
    }

    function init() {
        document.body.appendChild(btn);
        document.body.appendChild(win);
        document.getElementById('aiChatClose').onclick = toggle;
        document.getElementById('aiChatSend').onclick = function () {
            send(document.getElementById('aiChatInput').value);
        };
        document.getElementById('aiChatInput').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') send(e.target.value);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
