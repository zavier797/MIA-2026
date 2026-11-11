/* AksiWarga - React 18 (UMD, tanpa build step & tanpa JSX supaya bisa dibuka langsung dari file) */
const { useState, useEffect, useRef, Fragment, createElement: h } = React;
const { BrowserRouter, MemoryRouter, Routes, Route, Navigate, useNavigate } = ReactRouterDOM;
const AppRouter = window.location.protocol === 'file:' ? MemoryRouter : BrowserRouter;
const APP_DIRECTORY_URL = document.currentScript?.src
    ? new URL('.', document.currentScript.src)
    : new URL('.', window.location.href);
const BEFORE_AFTER_ALL_URL = new URL('before_dan_after_all.html', APP_DIRECTORY_URL).href;
const USER_PROFILE_URL = new URL('user_profile.html', APP_DIRECTORY_URL).href;
const LOGIN_URL = new URL('login.html', APP_DIRECTORY_URL).href;
const REPORT_FORM_URL = new URL('form_pengaduan.html', APP_DIRECTORY_URL).href;
const APBD_TRANSPARENCY_URL = new URL('transparansi_anggaran_apbd.html', APP_DIRECTORY_URL).href;
const REPORT_HISTORY_URL = new URL('rekam_jejak_detail.html', APP_DIRECTORY_URL).href;
const CATEGORY_DETAIL_URL = new URL('detail_kategori_masalah.html', APP_DIRECTORY_URL).href;
const MAP_DETAIL_URL = new URL('../map%20aksiwarga/index.html', APP_DIRECTORY_URL).href;

const BA_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const baDate = (value) => {
    const [year, month, day] = value.split('-');
    return new Date(Number(year), Number(month) - 1, Number(day));
};
const baFormatDate = (date, full) => `${date.getDate()} ${full ? BA_MONTHS[date.getMonth()] : BA_MONTHS[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;
const baPlaceholder = (color, text) => `https://placehold.co/600x600/${color}/e5dccb?text=${text}`;
const BA_PLACEHOLDER_IMAGES = [baPlaceholder('5a4636', 'Sebelum'), baPlaceholder('4a6b4f', 'Sesudah')];
const BA_ITEMS = [
    {
        no: '0892', kota: 'Jakarta Selatan', judul: 'Perbaikan Jalan Berlubang Parah di Jl. Fatmawati',
        ringkas: 'Jalan berlubang yang membahayakan pengendara telah ditambal dan diaspal ulang.',
        dinas: 'Dinas Bina Marga', hari: 2, kat: 'Infrastruktur Jalan',
        keluhan: 'Terdapat lubang jalan cukup dalam dan lebar di lajur kiri dekat lampu merah yang sangat membahayakan pengendara motor saat malam hari.',
        alamat: 'Jl. Fatmawati No. 12, Kel. Cilandak Barat, Kec. Cilandak, Jakarta Selatan',
        pelapor: 'Ahmad Warga', biaya: 'Rp 4.500.000',
        catatan: 'Pembersihan area lubang, pelapisan fondasi tack coat, dan penambalan dengan aspal hotmix 5cm dilanjutkan penggilasan drum roller.',
        gps: '-6.2915, 106.7972', mulai: '2026-03-12', tiket: 'TW-2026-0892', regu: 'B',
        img: [
            'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1584467735815-f778f274e296?auto=format&fit=crop&w=600&q=80',
        ],
    },
    {
        no: '0731', kota: 'Bandung', judul: 'Pembersihan Tumpukan Sampah Bantaran Sungai',
        ringkas: 'Penumpukan sampah yang menyumbat aliran sungai berhasil dibersihkan dan lokasi kini tertata rapi.',
        dinas: 'Dinas Lingkungan Hidup', hari: 1, kat: 'Kebersihan & Lingkungan',
        keluhan: 'Sampah menumpuk di bantaran sungai hingga menutup aliran air dan menimbulkan bau menyengat bagi warga sekitar.',
        alamat: 'Bantaran Sungai Cikapundung, Kel. Braga, Kec. Sumur Bandung, Kota Bandung',
        pelapor: 'Siti Rahma', biaya: 'Rp 2.800.000',
        catatan: 'Pengangkatan sampah dengan alat berat ringan, pembersihan sedimen, dan pemasangan jaring penahan sampah.',
        gps: '-6.9147, 107.6098', mulai: '2026-03-20', tiket: 'TW-2026-0731', regu: 'A',
        img: BA_PLACEHOLDER_IMAGES,
    },
    {
        no: '0954', kota: 'Surabaya', judul: 'Perbaikan Lampu Penerangan Jalan (PJU)',
        ringkas: 'Penggantian bohlam PJU yang mati di area permukiman untuk mencegah potensi kejahatan malam.',
        dinas: 'Dinas Perhubungan', hari: 3, kat: 'Penerangan Jalan',
        keluhan: 'Lampu jalan di gang permukiman mati berminggu-minggu sehingga area menjadi gelap dan rawan tindak kejahatan.',
        alamat: 'Jl. Darmo Permai Selatan, Kel. Putat Gede, Kec. Sukomanunggal, Surabaya',
        pelapor: 'Budi Santoso', biaya: 'Rp 3.200.000',
        catatan: 'Penggantian 6 titik bohlam dan fotosel PJU, pengecekan kabel, serta uji nyala pada malam hari.',
        gps: '-7.2899, 112.7138', mulai: '2026-04-02', tiket: 'TW-2026-0954', regu: 'C',
        img: BA_PLACEHOLDER_IMAGES,
    },
];

/* ===== DATA ===== */
const SHORTCUT_LINKS = [
    { label: 'Laporan', target: '/#laporan' },
    { label: 'Peta', target: '/#peta' },
    { label: 'Statistik', target: '/#statistik' },
    { label: 'Hasil', target: '/#hasil' },
];

const DESKTOP_MENU_LINKS = [
    { label: 'FAQ', href: '/FAQ.html' },
];
const TERMS_URL = 'syarat&ketentuan.html';

function Island({ hidden, onNavigate }) {
    const [open, setOpen] = useState(false);
    const island = useRef(null);

    useEffect(() => {
        const closeOnOutsideClick = (event) => {
            if (island.current && !island.current.contains(event.target)) setOpen(false);
        };
        document.addEventListener('pointerdown', closeOnOutsideClick);
        return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
    }, []);

    if (hidden) return null;

    const handleLink = (event, item) => {
        setOpen(false);
        onNavigate();
        if (item.target.startsWith('/#') || item.target.startsWith('#')) {
            event.preventDefault();
            const id = item.target.slice(item.target.indexOf('#') + 1);
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return h('nav', {
        ref: island,
        className: 'island',
        'aria-label': 'Navigasi cepat',
        'data-open': String(open),
        onPointerEnter: (event) => { if (event.pointerType === 'mouse') setOpen(true); },
        onPointerLeave: (event) => { if (event.pointerType === 'mouse') setOpen(false); },
    },
        h('button', {
            type: 'button',
            className: 'island-dots',
            'aria-label': open ? 'Tutup navigasi cepat' : 'Buka navigasi cepat',
            'aria-expanded': open,
            onClick: () => setOpen((value) => !value),
        }, h('i'), h('i'), h('i'), h('i')),
        h('ul', { className: 'island-links' }, SHORTCUT_LINKS.map((item) =>
            h('li', { key: item.label },
                h('a', { href: item.target, onClick: (event) => handleLink(event, item) }, item.label)))));
}

/* corner = sudut kotak yang menghadap titik tengah blok */
const STATS = [
    { label: 'Total Laporan', value: 'loading', strong: '+12 hari ini', note: ' dari seluruh wilayah', corner: 'br' },
    { label: 'Berhasil diselesaikan', value: 'loading', strong: '89%', note: ' tingkat penyelesaian total', corner: 'bl', valueColor: '#15803d' },
    { label: 'Rata-rata respon', value: 'loading', note: 'Waktu tanggap awal oleh instansi', corner: 'tr' },
    { label: 'Belum ditanggapi', value: 'loading', note: 'Melewati batas SLA (transparan)', corner: 'tl', valueColor: '#dc2626' }
];

/* ===== HOOK: apakah header sedang berada di atas section terang? ===== */
function useOnLight() {
    const [light, setLight] = useState(false);
    useEffect(() => {
        const check = () => setLight([...document.querySelectorAll('[data-light]')].some((el) => {
            const r = el.getBoundingClientRect();
            return r.top <= 40 && r.bottom > 40;
        }));
        check();
        window.addEventListener('scroll', check, { passive: true });
        window.addEventListener('resize', check);
        return () => { window.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
    }, []);
    return light;
}

function useAfterHero() {
    const [afterHero, setAfterHero] = useState(false);
    useEffect(() => {
        const check = () => {
            const hero = document.getElementById('beranda');
            setAfterHero(Boolean(hero && hero.getBoundingClientRect().bottom <= 0));
        };
        check();
        window.addEventListener('scroll', check, { passive: true });
        window.addEventListener('resize', check);
        return () => { window.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
    }, []);
    return afterHero;
}

/* ===== HEADER: akun, tema, lalu tombol menu ===== */
function Header({ open, light, afterHero, setOpen, theme, setTheme }) {
    const navigate = useNavigate();
    const { user, isLoggedIn } = useAuth();
    const initials = user ? user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() : '';
    const signIn = () => {
        setOpen(false);
        window.location.href = LOGIN_URL;
    };
    const openProfile = () => {
        setOpen(false);
        window.location.href = USER_PROFILE_URL;
    };
    const goHome = (event) => {
        if (window.location.protocol !== 'file:') return setOpen(false);
        event.preventDefault();
        setOpen(false);
        document.getElementById('beranda')?.scrollIntoView({ behavior: 'smooth' });
    };

    return h('header', { className: 'site-header', 'data-light': String(light && !open), 'data-after-hero': String(afterHero && !open), 'data-menu': String(open) },
        h('a', { href: window.location.protocol === 'file:' ? '#beranda' : '/#beranda', className: 'brand', onClick: goHome },
            h('span', { className: 'tile' }, h('img', { src: '../asset/logo%20web.jpg', alt: 'Logo AksiWarga' })),
            h('span', { className: 'brand-name' }, 'AksiWarga')),
        h('div', { className: 'header-right' },
            h('div', { className: 'header-tools' },
                h('div', { className: 'auth' },
                    isLoggedIn
                        ? h('button', { type: 'button', className: 'account-button', onClick: openProfile, 'aria-label': `Buka akun ${user.name}` },
                            user.avatarUrl
                                ? h('img', { className: 'user-avatar', src: user.avatarUrl, alt: '' })
                                : h('span', { className: 'user-avatar avatar-initials', 'aria-hidden': 'true' }, initials),
                            h('span', { className: 'account-name' }, user.name))
                        : h('button', { type: 'button', className: 'auth-in', onClick: signIn }, 'Sign in')),
                h('button', {
                    type: 'button', className: 'theme-toggle',
                    'aria-label': `Ganti ke tema ${theme === 'light' ? 'gelap' : 'terang'}`,
                    onClick: () => setTheme(theme === 'light' ? 'dark' : 'light'),
                },
                    h('svg', {
                        className: `theme-icon ${theme === 'light' ? 'theme-icon-moon' : 'theme-icon-sun'}`,
                        viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
                        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
                    }, theme === 'light'
                        ? h('path', { d: 'M20.3 15.3A8.5 8.5 0 0 1 8.7 3.7 8.5 8.5 0 1 0 20.3 15.3Z' })
                        : h(Fragment, null,
                            h('circle', { cx: 12, cy: 12, r: 4 }),
                            h('path', { d: 'M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42' }))))),
            h('button', {
                type: 'button', className: 'menu-btn', 'aria-expanded': open, 'aria-controls': 'menu-panel',
                'aria-label': open ? 'Tutup menu' : 'Buka menu', onClick: () => setOpen(!open),
            },
                h('span', { className: 'menu-label' }, open ? 'Tutup' : 'Menu'),
                h('span', { className: 'tile burger', 'aria-hidden': 'true' }, h('i'), h('i')))));
}

/* ===== DROPDOWN MENU ===== */
function MenuPanel({ open, setOpen }) {
    const navigate = useNavigate();
    const { isLoggedIn, authReady } = useAuth();
    const [loginPrompt, setLoginPrompt] = useState(false);
    const [pendingTarget, setPendingTarget] = useState(null);
    const menuLinks = [
        { label: 'Buat Laporan', href: isLoggedIn ? REPORT_FORM_URL : '#login-required', target: REPORT_FORM_URL, requiresLogin: true },
        { label: 'Cek Laporan', href: isLoggedIn ? USER_PROFILE_URL : '#login-required', target: USER_PROFILE_URL, requiresLogin: true },
        { label: 'Transparansi Data', href: APBD_TRANSPARENCY_URL },
        ...DESKTOP_MENU_LINKS,
    ];
    const close = () => setOpen(false);
    useEffect(() => {
        if (!authReady || !pendingTarget) return;
        if (isLoggedIn) {
            window.location.href = pendingTarget;
            return;
        }
        setPendingTarget(null);
        setLoginPrompt(true);
    }, [authReady, isLoggedIn, pendingTarget]);

    useEffect(() => {
        if (!loginPrompt) return undefined;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') setLoginPrompt(false);
        };
        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [loginPrompt]);

    const handleMenuClick = (event, href) => {
        close();
        if (window.location.protocol !== 'file:' || !href.startsWith('/')) return;
        if (href.startsWith('/#')) {
            event.preventDefault();
            document.getElementById(href.slice(2))?.scrollIntoView({ behavior: 'smooth' });
        } else if (!href.endsWith('.html')) {
            event.preventDefault();
            navigate(href);
        }
    };
    const handleProtectedMenuClick = (event, item) => {
        if (isLoggedIn) {
            handleMenuClick(event, item.href);
            return;
        }
        event.preventDefault();
        close();
        if (authReady) {
            setLoginPrompt(true);
        } else {
            setPendingTarget(item.target);
        }
    };
    const handleShortcutClick = (event, target) => {
        close();
        if (window.location.protocol !== 'file:' || !target.startsWith('/#')) return;
        event.preventDefault();
        document.getElementById(target.slice(2))?.scrollIntoView({ behavior: 'smooth' });
    };
    return h(Fragment, null,
        h('div', { id: 'menu-panel', className: 'menu-panel', 'data-open': String(open), inert: open ? undefined : '' },
            h('ul', { className: 'menu-list desktop-menu-list' }, menuLinks.map((item, i) =>
                h('li', { key: item.label, className: 'menu-item menu-group', style: { '--i': i } },
                    h('a', {
                        href: item.href,
                        className: 'menu-link',
                        onClick: (event) => item.requiresLogin
                            ? handleProtectedMenuClick(event, item)
                            : handleMenuClick(event, item.href),
                    }, item.label)))),
            h('ul', { className: 'mobile-shortcuts menu-item', style: { '--i': 0 } }, SHORTCUT_LINKS.map((item) =>
                h('li', { key: item.label },
                    h('a', { href: item.target, onClick: (event) => handleShortcutClick(event, item.target) }, item.label)))),
            h('div', { className: 'menu-footer menu-item', style: { '--i': menuLinks.length } },
                h('a', { href: TERMS_URL, className: 'menu-terms' }, 'Syarat & Ketentuan'),
                h('span', { className: 'menu-credit' }, '© 2026 AksiWarga'))),
        loginPrompt && h('div', {
            className: 'fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm',
            role: 'presentation',
            onClick: (event) => {
                if (event.target === event.currentTarget) setLoginPrompt(false);
            },
        },
            h('section', {
                className: 'w-full max-w-sm rounded-3xl border border-warm-200 bg-white p-6 text-center text-warm-900 shadow-2xl',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': 'login-prompt-title',
            },
                h('div', { className: 'mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700' },
                    h('i', { className: 'fa-solid fa-lock', 'aria-hidden': 'true' })),
                h('h2', { id: 'login-prompt-title', className: 'text-lg font-bold' }, 'Silahkan Login Terlebih dahulu'),
                h('p', { className: 'mt-2 text-sm text-warm-600' }, 'Masuk ke akun AksiWarga untuk melanjutkan.'),
                h('div', { className: 'mt-6 flex justify-center gap-3' },
                    h('button', {
                        type: 'button',
                        className: 'rounded-xl border border-warm-200 bg-warm-50 px-4 py-2 text-sm font-semibold text-warm-700 transition hover:bg-warm-100',
                        onClick: () => setLoginPrompt(false),
                    }, 'Batal'),
                    h('a', {
                        href: LOGIN_URL,
                        className: 'rounded-xl bg-amber-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-800',
                    }, 'Sign in')))));
}

/* ===== HERO (background tidak diubah) ===== */
function Hero() {
    const { isLoggedIn } = useAuth();
    const btn = 'w-full rounded-full px-7 py-3.5 text-center text-sm font-medium transition sm:w-auto';
    const reportHref = isLoggedIn ? REPORT_FORM_URL : (LOGIN_URL + '?redirect=form_pengaduan.html');
    return h('section', { id: 'beranda', className: 'relative flex min-h-screen items-center justify-center overflow-hidden' },
        h('div', { className: 'absolute inset-0 z-0 bg-cover bg-center', style: { backgroundImage: "url('../asset/all%20in%20one.jpg')" } }),
        h('div', { className: 'absolute inset-0 z-0 bg-slate-950/60' }),
        h('div', { className: 'relative z-10 mx-auto max-w-4xl px-6 py-28 text-center' },
            h('h1', { className: 'text-5xl font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-6xl md:text-7xl lg:text-8xl' },
                'Tak Ada Lagi Masalah yang Tersembunyi.'),
            h('p', { className: 'mx-auto mt-8 max-w-xl text-base leading-relaxed text-white/80 md:text-lg' },
                'Mulai dari tumpukan sampah hingga antrean bansos—kini warga bisa mengawasi kinerja pelayanan publik tanpa batasan birokrasi.'),
            h('div', { className: 'mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row' },
                h('a', { href: '#peta', className: btn + ' hero-map-link' }, 'Lihat Peta'),
                h('a', { href: reportHref, className: btn + ' border border-white/50 text-white hover:bg-white/10' }, 'Laporkan Masalah'))));
}

/* ===== KOTAK DATA: outline dihitung dari ukuran kotak ===== */
const GAP = 7, EDGE = 1; /* GAP: garis ke titik tengah, EDGE: garis ke sisi luar */

function Stat({ label, value, strong, note, corner, valueColor }) {
    const cell = useRef(null);
    const path = useRef(null);

    useEffect(() => {
        const fit = () => {
            const w = cell.current.offsetWidth, ht = cell.current.offsetHeight;
            const ix = corner.includes('r') ? w - GAP : GAP,  ox = corner.includes('r') ? EDGE : w - EDGE;
            const iy = corner.includes('b') ? ht - GAP : GAP, oy = corner.includes('b') ? EDGE : ht - EDGE;
            path.current.setAttribute('d', `M${ix} ${iy}H${ox}V${oy}H${ix}Z`); /* mulai dari siku "L" */
            path.current.style.setProperty('--len', path.current.getTotalLength());
        };
        const ro = new ResizeObserver(fit);
        ro.observe(cell.current);
        return () => ro.disconnect();
    }, [corner]);

    return h('a', {
        ref: cell, href: REPORT_HISTORY_URL, 'data-corner': corner, className: 'stat flex flex-col items-center justify-center p-5 text-center sm:p-8 md:p-12',
    },
        h('svg', { 'aria-hidden': 'true' }, h('path', { ref: path })),
        h('p', { className: 'text-xs font-medium text-muted sm:text-sm' }, label),
        h('p', { className: 'mt-3 text-4xl font-semibold tracking-[-0.04em] tabular-nums sm:text-5xl md:text-6xl', style: valueColor ? { color: valueColor } : undefined }, value),
        h('p', { className: 'mt-3 text-xs leading-relaxed text-muted' },
            strong && h('span', { className: 'font-medium text-ink' }, strong), note));
}

function Stats() {
    const [stats, setStats] = useState(STATS);
    const [insight, setInsight] = useState(null);
    const [loadingInsight, setLoadingInsight] = useState(true);
    
    useEffect(() => {
        fetch('/api/reports')
            .then(res => res.json())
            .then(data => {
                const total = data.total || 0;
                const selesai = data.reports.filter(r => r.status === 'Selesai').length;
                const pending = data.reports.filter(r => r.status === 'Menunggu Verifikasi').length;
                const resolutionRate = total > 0 ? Math.round((selesai / total) * 100) : 0;
                
                // Calculate average SLA in days
                const completed = data.reports.filter(r => r.status === 'Selesai');
                let avgSLA = 0;
                if (completed.length > 0) {
                    const totalDays = completed.reduce((sum, r) => {
                        const created = new Date(r.createdAt);
                        const updated = new Date(r.updatedAt);
                        const days = (updated - created) / (1000 * 60 * 60 * 24);
                        return sum + days;
                    }, 0);
                    avgSLA = (totalDays / completed.length).toFixed(1);
                }
                
                setStats([
                    { label: 'Total Laporan', value: total.toLocaleString('id-ID'), strong: '+12 hari ini', note: ' dari seluruh wilayah', corner: 'br' },
                    { label: 'Berhasil diselesaikan', value: selesai.toLocaleString('id-ID'), strong: `${resolutionRate}%`, note: ' tingkat penyelesaian total', corner: 'bl', valueColor: '#15803d' },
                    { label: 'Rata-rata respon', value: `${avgSLA} hari`, note: 'Waktu tanggap awal oleh instansi', corner: 'tr' },
                    { label: 'Belum ditanggapi', value: pending.toLocaleString('id-ID'), note: 'Melewati batas SLA (transparan)', corner: 'tl', valueColor: '#dc2626' }
                ]);
            })
            .catch(err => console.error('Failed to load stats:', err));
    }, []);
    
    useEffect(() => {
            fetch('/api/ai/insights')
                .then(r => r.json())
                .then(d => { setInsight(d.insight); setLoadingInsight(false); })
                .catch(() => setLoadingInsight(false));
        }, []);
    
        const [showInsight, setShowInsight] = useState(false);
    
            return h('section', { id: 'laporan', 'data-light': '', className: 'bg-paper px-6 py-20' },
                h('div', { className: 'mx-auto w-full max-w-4xl' },
                    h('div', { className: 'stats-heading mb-10 text-left' },
                        h('h2', { className: 'text-4xl font-semibold tracking-[-0.035em] md:text-5xl' }, 'Rekam Jejak Pengaduan'),
                        h('p', { className: 'mt-4 max-w-2xl text-muted' }, 'Sejauh mana suara warga didengar dan ditindaklanjuti oleh pihak berwenang.')),
                    h('div', { className: 'grid grid-cols-2' }, stats.map((s) => h(Stat, { key: s.label, ...s }))),
                    h(Actions),
                    h('div', { className: 'mt-6' },
                        h('button', {
                            onClick: () => setShowInsight(!showInsight),
                            className: 'inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg px-3 py-1.5 transition'
                        },
                            h('i', { className: 'fa-solid fa-wand-magic-sparkles text-[10px]' }),
                            h('span', null, showInsight ? 'Sembunyikan AI Insights' : 'Tampilkan AI Insights')
                        ),
                        showInsight && h('div', { className: 'mt-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 md:p-6 animate-slide-down' },
                            h('div', { className: 'flex items-center gap-2 mb-3' },
                                h('span', { className: 'inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 bg-violet-100 rounded-full px-3 py-1' }, '✦ AI Insights'),
                                h('span', { className: 'text-xs text-muted' }, 'Dianalisis otomatis dari ' + (stats[0]?.value || '0').replace(/\./g, '') + ' laporan')),
                            loadingInsight
                                ? h('div', { className: 'animate-pulse space-y-2' },
                                    h('div', { className: 'h-4 bg-violet-100 rounded w-3/4' }),
                                    h('div', { className: 'h-4 bg-violet-100 rounded w-1/2' }))
                                : h('p', { className: 'text-sm md:text-base text-warm-800 leading-relaxed' }, insight)
                        )
                    )
                ));
}

/* ===== IKON (inline SVG, ikut warna teks) ===== */
const pth = (d) => h('path', { d });
const ICONS = {
    plus: [pth('M12 5v14M5 12h14')],
    clock: [h('circle', { cx: 12, cy: 12, r: 9 }), pth('M12 7v5l3 2')],
    link: [pth('M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5')],
    pin: [pth('M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z'), h('circle', { cx: 12, cy: 10, r: 2.5 })],
    down: [pth('M7 7l10 10M17 8v9H8')],
};
function Icon({ name }) {
    return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }, ...ICONS[name]);
}
const Pie = () => h('svg', { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true' }, pth('M12 12l9.2 3.9A10 10 0 1 1 8 2.8z'), pth('M13.5 10.5V2.1A10 10 0 0 1 22 10.5z'));

function Heading({ title, sub }) {
    return h('div', { className: 'mb-10 text-left' },
        h('h2', { className: 'text-4xl font-semibold tracking-[-0.035em] md:text-5xl' }, title),
        h('p', { className: 'mt-4 max-w-2xl text-muted md:text-lg' }, sub));
}

/* ===== REKAM JEJAK: tombol Pengaduan Baru & Status Laporan ===== */
const ACTIONS = [
    { icon: 'plus', title: 'Pengaduan Baru', desc: 'Laporkan masalah atau keluhan Anda untuk ditindaklanjuti.', href: REPORT_FORM_URL, requiresLogin: true },
    { icon: 'clock', title: 'Status Laporan', desc: 'Pantau perkembangan laporan Anda dari masuk hingga selesai.', href: USER_PROFILE_URL, requiresLogin: true },
];
function Actions() {
    const { isLoggedIn } = useAuth();
    return h('div', { className: 'actions bleed' }, ACTIONS.map((a) => {
        const href = a.requiresLogin && !isLoggedIn ? (LOGIN_URL + '?redirect=' + a.href.split('/').pop()) : a.href;
        return h('a', { key: a.title, href, className: 'action' },
            h('span', { className: 'action-head' }, h('span', { className: 'action-ico' }, h(Icon, { name: a.icon })), h('strong', null, a.title)),
            h('span', { className: 'action-desc' }, a.desc));
    }));
}

/* ===== PETA INTERAKTIF ===== */
const LEGEND = [
    ['#35a66f', '85% atau lebih'],
    ['#438bd1', '70% sampai 85%'],
    ['#e7b83f', '55% sampai 70%'],
    ['#d9534f', 'Di bawah 55%'],
];
function Peta() {
    return h('section', { id: 'peta', 'data-light': '', className: 'section' },
        h('div', { className: 'wide' },
            h(Heading, { title: 'Lihat Lebih Luas', sub: 'Pantau daerahmu disini.' }),
            h('div', { className: 'map-bar' },
                h('p', { className: 'map-hint' }, h('i'), 'Arahkan kursor ke kabupaten/kota untuk melihat ringkasan pengaduan.'),
                h('a', { className: 'chip', href: MAP_DETAIL_URL }, h(Icon, { name: 'link' }), 'Lihat Detail')),
            h('div', { id: 'peta-indonesia', className: 'map-shape' }, h(window.IndonesiaMap)),
            h('div', { className: 'map-foot' },
                h('div', { className: 'card legend' },
                    h('h3', null, 'Tingkat penyelesaian (SLA)'),
                    h('ul', null, LEGEND.map(([c, t]) => h('li', { key: t },
                        h('i', { style: { background: c }, 'aria-hidden': 'true' }), t)))))));
}

/* ===== STATISTIK KINERJA: data (ganti sesuai data asli) ===== */
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const SERIES = [['selesai', '#16803c', 'Laporan diselesaikan'], ['masuk', '#3158e8', 'Laporan masuk']];
const TREND = { /* tambah tahun baru cukup dengan menambah baris di sini */
    2026: { masuk: [40, 20, 50, 11, 44, 24, 69, 10, 50, 34], selesai: [18, 28, 21, 46, 35, 61, 54, 58, 68, 92] },
    2025: { masuk: [22, 30, 26, 38, 41, 35, 48, 52, 44, 50, 46, 58], selesai: [15, 24, 22, 31, 35, 30, 42, 47, 40, 46, 43, 54] },
    2024: { masuk: [12, 18, 15, 24, 28, 22, 30, 33, 29, 35, 31, 38], selesai: [8, 13, 12, 19, 22, 18, 25, 28, 25, 30, 27, 33] },
};
const YEARS = Object.keys(TREND).map(Number).reverse();
const RATIO = [['#16803c', 45, 'Selesai'], ['#ca8a04', 35, 'Proses'], ['#dc2626', 20, 'Overdue']];
const RANKING = [
    ['Dinas Bina Marga', 'Infrastruktur', 440, '94%', '1.2 Hari', '🙂'],
    ['Dinas Lingkungan Hidup', 'Kebersihan', 386, '88%', '1.4 Hari', '🙂'],
    ['Dinas Sosial', 'Bantuan Sosial (Bansos)', 350, '82%', '2.1 Hari', '🙁'],
    ['Dinas Perhubungan', 'Keselamatan Umum', 280, '78%', '2.4 Hari', '🙂'],
];
const CATEGORIES = [['Infrastruktur & Jalan', 45], ['Lingkungan & Sampah', 25], ['Bantuan Sosial (Bansos)', 16], ['Fasilitas Umum & Lainnya', 12]];

/* Garis melengkung halus (Catmull-Rom -> Bezier) */
const smooth = (pts) => pts.map(([px, py], i) => {
    if (!i) return `M${px} ${py}`;
    const a = pts[i - 2] || pts[i - 1], b = pts[i - 1], c = pts[i + 1] || pts[i];
    return `C${b[0] + (px - a[0]) / 6} ${b[1] + (py - a[1]) / 6} ${px - (c[0] - b[0]) / 6} ${py - (c[1] - b[1]) / 6} ${px} ${py}`;
}).join('');

function TrendChart({ year }) {
    const d = TREND[year], n = d.masuk.length;
    const W = 1000, H = 340, L = 50, R = 24, T = 30, B = 56;
    const top = Math.max(100, Math.ceil(Math.max(...d.masuk, ...d.selesai) / 25) * 25);
    const x = (i) => L + (i * (W - L - R)) / (n - 1);
    const y = (v) => T + (H - T - B) * (1 - v / top);
    return h('svg', { className: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Grafik laporan masuk dan diselesaikan per bulan, tahun ${year}` },
        h('text', { x: 0, y: 12, className: 'ax' }, 'Jumlah Laporan'),
        ...Array.from({ length: top / 25 + 1 }, (_, i) => i * 25).map((t) => h('g', { key: 'y' + t },
            h('line', { x1: L, x2: W - R, y1: y(t), y2: y(t), className: 'grid' }),
            h('text', { x: L - 12, y: y(t) + 4, textAnchor: 'end', className: 'tick' }, t))),
        ...d.masuk.map((_, i) => h('text', { key: 'x' + i, x: x(i), y: H - B + 22, textAnchor: 'middle', className: 'tick' }, MONTHS[i])),
        h('text', { x: (L + W - R) / 2, y: H - 6, textAnchor: 'middle', className: 'ax' }, `Tahun ${year}`),
        ...SERIES.map(([k, c], s) => {
            const other = d[SERIES[1 - s][0]];
            const pts = d[k].map((v, i) => [x(i), y(v)]);
            return h('g', { key: k },
                h('path', { d: smooth(pts), fill: 'none', stroke: c, strokeWidth: 2 }),
                ...pts.map(([px, py], i) => h('g', { key: i },
                    h('circle', { cx: px, cy: py, r: 3.5, fill: c }),
                    h('text', { x: px, y: d[k][i] >= other[i] ? py - 10 : py + 17, textAnchor: 'middle', className: 'val', style: { fill: c } }, d[k][i]))));
        }));
}

function Trend() {
    const [year, setYear] = useState(YEARS[0]);
    const last = TREND[year].masuk.length - 1;
    return h('div', { className: 'card chart-card' },
        h('div', { className: 'chart-head' },
            h('div', null,
                h('h3', { className: 'card-title' }, `Tren Aktivitas Penanganan (${year})`),
                h('p', { className: 'card-sub' }, `Data resmi perbandingan laporan masuk dan laporan diselesaikan per bulan (${MONTHS[0]}–${MONTHS[last]} ${year}).`),
                h('ul', { className: 'key' }, SERIES.map(([k, c, label]) => h('li', { key: k }, h('i', { style: { background: c } }), label)))),
            h('label', { className: 'year' }, 'Tahun',
                h('select', { value: year, 'aria-label': 'Pilih tahun', onChange: (e) => setYear(Number(e.target.value)) }, YEARS.map((v) => h('option', { key: v, value: v }, v))))),
        h('div', { className: 'chart-scroll' }, h(TrendChart, { key: year, year })));
}

function Ranking() {
    return h('div', { className: 'card rank' },
        h('div', { className: 'rank-head' },
            h('div', null, h('h3', { className: 'card-title' }, 'Peringkat Kerja Instansi'), h('p', { className: 'card-sub' }, 'Data resmi peringkat instansi berdasarkan kinerja penanganan.')),
            h('div', { className: 'rank-cols' }, ['Total Aduan', 'Penyelesaian', 'AVG respon', 'Indeks Kepuasan Masyarakat'].map((c) => h('span', { key: c }, c)))),
        h('ol', { className: 'rank-list' }, RANKING.map(([name, dept, ...v], i) => h('li', { key: name },
            h('b', { className: 'rank-no' }, i + 1),
            h('span', { className: 'rank-name' }, h('strong', null, name), h('small', null, dept)),
            v.slice(0, 3).map((val, index) => h('span', { key: `${index}-${val}` }, val)),
            h('span', { className: 'rank-satisfaction' }, v[3])))),
        h('div', { className: 'rank-legend', 'aria-label': 'Keterangan indeks kepuasan masyarakat' },
            h('span', null, '🙂 Mayoritas Masyarakat senang.'),
            h('span', null, '🙁 Mayoritas Masyarakat kecewa.')));
}

function Categories() {
    return h('a', { href: CATEGORY_DETAIL_URL, className: 'card cats cats-link' },
        h('h3', { className: 'card-title' }, 'Kategori Masalah'),
        h('p', { className: 'card-sub' }, 'Tingkat penyelesaian per kategori.'),
        h('ul', null, CATEGORIES.map(([name, v]) => h('li', { key: name },
            h('div', null, h('span', null, name), h('b', null, v + '%')),
            h('div', { className: 'bar' }, h('i', { style: { width: v + '%' } }))))));
}

function Kinerja() {
    return h('section', { id: 'statistik', 'data-light': '', className: 'section' },
        h('div', { className: 'wide' },
            h(Heading, { title: 'Statistik Kinerja & Akuntabilitas', sub: 'Transparansi menyeluruh atas respons instansi dan tren penyelesaian aduan warga.' }),
            h('div', { className: 'kpis' },
                h('article', { className: 'card kpi' },
                    h('header', null, h('h3', { className: 'kpi-label' }, 'Rasio Status Global'), h(Pie)),
                    h('p', { className: 'kpi-value' }, '1.456', h('small', null, 'Total Aduan')),
                    h('p', { className: 'kpi-note' }, 'Proporsi status penanganan laporan saat ini di seluruh wilayah.'),
                    h('div', { className: 'kpi-foot' },
                        h('div', { className: 'ratio' }, RATIO.map(([c, w]) => h('i', { key: c, style: { background: c, flex: w } }))),
                        h('div', { className: 'ratio-key' }, RATIO.map(([c, w, l]) => h('span', { key: l, style: { color: c } }, `${l} (${w}%)`))))),
                h('article', { className: 'card kpi' },
                    h('header', null, h('h3', { className: 'kpi-label' }, 'Kepatuhan SLA Instansi')),
                    h('p', { className: 'kpi-value' }, '91%'),
                    h('p', { className: 'kpi-note' }, 'Sebagian besar instansi merespon aduan warga dalam batas waktu standar (3 hari kerja).'),
                    h('div', { className: 'kpi-foot sla' },
                        h('span', null, 'Tepat Waktu: ', h('strong', null, '1.257 Laporan')),
                        h('span', { className: 'late' }, 'Terlambat: ', h('strong', null, '56 Laporan')))),
                h('article', { className: 'card kpi' },
                    h('header', null, h('h3', { className: 'kpi-label' }, 'Kecepatan Tanggap'), h(Icon, { name: 'clock' })),
                    h('p', { className: 'kpi-value' }, '1.8', h('small', null, 'Hari')),
                    h('p', { className: 'kpi-note' }, 'Waktu rata-rata yang dibutuhkan dinas terkait untuk melakukan verifikasi laporan.'),
                    h('div', { className: 'kpi-foot' }, h('span', { className: 'pill' }, h(Icon, { name: 'down' }), '-0.4 hari dari bulan lalu')))),
            h(Trend),
            h('div', { className: 'rank-row' }, h(Ranking), h(Categories))));
}

function BeforeAfterEyebrow({ children }) {
    return h('div', { className: 'flex items-center justify-center gap-3 text-[11px] font-medium tracking-[.2em] text-[#c4833f] uppercase' },
        h('span', { className: 'h-px w-10 bg-[#c4833f]/60' }), children,
        h('span', { className: 'h-px w-10 bg-[#c4833f]/60' }));
}

function BeforeAfterHeading({ children, className = 'text-[40px]' }) {
    return h('h2', { className: `mt-4 font-bold leading-tight tracking-tight text-[#2f1d10] ${className}` }, children);
}

function BeforeAfterSub({ children }) {
    return h('p', { className: 'mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-[#7c6b5c]' }, children);
}

function BeforeAfterCard({ item, onOpen }) {
    return h('article', {
        role: 'button', tabIndex: 0, 'aria-label': `Lihat detail: ${item.judul}`,
        onClick: () => onOpen(item),
        onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpen(item);
            }
        },
        className: 'cursor-pointer overflow-hidden rounded-2xl bg-white shadow-[0_4px_20px_rgba(80,50,20,.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(80,50,20,.16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c4833f]',
    },
        h('div', { className: 'grid aspect-[1.87/1] grid-cols-2 gap-[2px] bg-white' }, [0, 1].map((index) =>
            h('div', { key: index, className: 'relative overflow-hidden' },
                h('img', {
                    src: item.img[index], alt: index ? 'Sesudah' : 'Sebelum', loading: 'lazy',
                    className: 'absolute inset-0 h-full w-full object-cover',
                    onError: (event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = BA_PLACEHOLDER_IMAGES[index];
                    },
                }),
                h('span', {
                    className: `absolute left-2.5 top-2.5 rounded-md px-2 py-1 text-[10px] font-bold tracking-wider text-white ${index ? 'bg-[#5f8a64]/90' : 'bg-[#3b2f27]/85'}`,
                }, index ? 'SESUDAH' : 'SEBELUM')))),
        h('div', { className: 'p-[18px]' },
            h('div', { className: 'flex items-center gap-1.5 text-xs font-medium text-[#c4833f]' },
                h('i', { className: 'fa-solid fa-location-dot text-[11px]' }), item.kota),
            h('h3', { className: 'mt-2 text-[15px] font-bold leading-snug text-[#2f1d10]' }, item.judul),
            h('p', { className: 'mt-2 text-[13px] leading-relaxed text-[#8a7a6c]' }, item.ringkas),
            h('div', { className: 'mt-4 flex items-center justify-between gap-2 border-t border-[#f0e9df] pt-3' },
                h('span', { className: 'flex items-center gap-1.5 text-[11.5px] text-[#a89a8b]' },
                    h('i', { className: 'fa-regular fa-clock' }), `Selesai ${item.hari} Hari`),
                h('span', { className: 'rounded-full bg-[#f8e9d6] px-3 py-1 text-[11.5px] font-semibold text-[#b0702c]' }, item.dinas))));
}

function BeforeAfterPhoto({ src, label, gps, by, before }) {
    return h('div', { className: 'group relative overflow-hidden rounded-2xl border border-warm-200 bg-warm-100' },
        h('div', { className: 'relative aspect-square w-full' },
            h('img', {
                src, alt: `Kondisi ${label}`,
                className: `h-full w-full object-cover transition duration-300 group-hover:scale-105 ${before ? 'grayscale-[30%]' : ''}`,
                onError: (event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = baPlaceholder('231d19', `Foto+${label}`);
                },
            }),
            h('div', {
                className: 'absolute left-3 top-3 rounded-lg border border-white/70 bg-warm-50/95 px-3 py-1 text-xs font-bold uppercase tracking-wider text-warm-800 shadow-sm',
            }, label),
            h('div', { className: 'absolute inset-x-0 bottom-0 space-y-0.5 bg-gradient-to-t from-[#231d19]/85 via-[#231d19]/45 to-transparent p-3 text-[10px] text-white/90' },
                h('p', { className: 'flex items-center gap-1 font-mono' },
                    h('i', { className: 'fa-solid fa-location-crosshairs text-amber-300' }), h('span', null, gps)),
                h('p', { className: 'text-white/75' }, by))));
}

function BeforeAfterModal({ item, onClose }) {
    const submitted = baDate(item.mulai);
    const completed = new Date(submitted.getFullYear(), submitted.getMonth(), submitted.getDate() + item.hari);

    useEffect(() => {
        const handleKey = (event) => { if (event.key === 'Escape') onClose(); };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKey);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKey);
        };
    }, [onClose]);

    const infoLabel = (label, value) => h('div', null,
        h('span', { className: 'block text-[11px] text-warm-500' }, label),
        h('strong', { className: 'font-semibold text-warm-900' }, value));

    return h('div', { className: 'fixed inset-0 z-[100] flex items-center justify-center p-4 font-jakarta text-warm-900 antialiased sm:p-6' },
        h('div', { className: 'animate-bg absolute inset-0 bg-warm-900/45 backdrop-blur-sm', onClick: onClose }),
        h('div', { role: 'dialog', 'aria-modal': 'true', 'aria-label': `Detail pengaduan ${item.tiket}`, className: 'animate-modal relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-warm-200 bg-[#fffdf9] shadow-2xl' },
            h('div', { className: 'sticky top-0 z-20 flex items-center justify-between border-b border-warm-200 bg-[#fffdf9]/95 px-6 py-4' },
                h('div', { className: 'flex items-center gap-3' },
                    h('div', { className: 'flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-xs font-bold text-amber-800' },
                        h('i', { className: 'fa-solid fa-file-invoice' })),
                    h('div', null,
                        h('h2', { className: 'text-sm font-extrabold tracking-tight text-warm-900 sm:text-base' }, 'Detail Transparansi Pengaduan'),
                        h('span', { className: 'font-mono text-[11px] font-bold text-amber-800' }, `#${item.tiket}`))),
                h('button', { type: 'button', autoFocus: true, onClick: onClose, className: 'flex h-8 w-8 items-center justify-center rounded-full bg-warm-100 text-sm text-warm-600 transition hover:bg-warm-200 hover:text-warm-900', title: 'Tutup', 'aria-label': 'Tutup' },
                    h('i', { className: 'fa-solid fa-xmark' }))),
            h('div', { className: 'flex-1 space-y-6 overflow-y-auto p-6' },
                h('div', { className: 'rounded-2xl border border-warm-200 bg-warm-50 p-4 sm:p-5' },
                    h('div', { className: 'flex flex-wrap items-center justify-between gap-3 border-b border-warm-200 pb-3' },
                        h('div', { className: 'flex items-center gap-2' },
                            h('span', { className: 'rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800' }, item.kat),
                            h('span', { className: 'text-xs font-medium text-warm-600' }, item.dinas)),
                        h('span', { className: 'inline-flex items-center gap-1.5 rounded-full border border-warm-200 bg-white px-3 py-1 text-xs font-semibold text-warm-700' },
                            h('i', { className: 'fa-solid fa-circle-check text-xs text-amber-700' }), 'Selesai')),
                    h('div', { className: 'grid grid-cols-2 gap-3 pt-3.5 text-xs sm:grid-cols-3' },
                        infoLabel('Tanggal Diajukan', baFormatDate(submitted, true)),
                        infoLabel('Tanggal Selesai', baFormatDate(completed, true)),
                        h('div', { className: 'col-span-2 sm:col-span-1' },
                            h('span', { className: 'block text-[11px] text-warm-500' }, 'Durasi SLA Penanganan'),
                            h('strong', { className: 'flex items-center gap-1 font-bold text-amber-800' },
                                h('i', { className: 'fa-regular fa-clock text-[11px]' }), `${item.hari} Hari (${item.hari * 24} Jam)`)))),
                h('div', null,
                    h('h3', { className: 'mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-warm-600' },
                        h('i', { className: 'fa-solid fa-images text-xs text-amber-700' }), 'Dokumentasi Komparasi Visual'),
                    h('div', { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2' },
                        h(BeforeAfterPhoto, { src: item.img[0], label: 'Sebelum', before: true, gps: item.gps, by: `Foto Pelapor • ${baFormatDate(submitted)}, 09:15 WIB` }),
                        h(BeforeAfterPhoto, { src: item.img[1], label: 'Sesudah', gps: item.gps, by: `Petugas Lapangan • ${baFormatDate(completed)}, 14:30 WIB` }))),
                h('div', { className: 'space-y-4 rounded-2xl border border-warm-200 bg-warm-50/80 p-5' },
                    h('h3', { className: 'flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-warm-600' },
                        h('i', { className: 'fa-solid fa-circle-info text-xs text-amber-700' }), 'Informasi Keluhan Warga'),
                    h('div', null,
                        h('h4', { className: 'mb-1.5 text-base font-bold text-warm-900' }, item.judul),
                        h('p', { className: 'rounded-xl border border-warm-200 bg-white p-3.5 text-xs leading-relaxed text-warm-700 sm:text-sm' }, `“${item.keluhan}”`)),
                    h('div', { className: 'grid grid-cols-1 gap-3 pt-2 text-xs sm:grid-cols-2' },
                        h('div', { className: 'flex items-start gap-2.5' },
                            h('i', { className: 'fa-solid fa-location-dot mt-0.5 shrink-0 text-amber-700' }),
                            h('div', null, h('span', { className: 'block text-[11px] text-warm-500' }, 'Lokasi Kejadian'),
                                h('span', { className: 'block font-medium leading-tight text-warm-800' }, item.alamat))),
                        h('div', { className: 'flex items-start gap-2.5' },
                            h('i', { className: 'fa-solid fa-user mt-0.5 shrink-0 text-amber-700' }),
                            h('div', null, h('span', { className: 'block text-[11px] text-warm-500' }, 'Identitas Pelapor'),
                                h('span', { className: 'font-medium text-warm-800' }, item.pelapor))))),
                h('div', { className: 'space-y-4 rounded-2xl border border-warm-200 bg-warm-50/80 p-5' },
                    h('h3', { className: 'flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800' },
                        h('i', { className: 'fa-solid fa-sack-dollar text-xs text-amber-700' }), 'Eksekusi Lapangan & Transparansi Anggaran'),
                    h('div', { className: 'grid grid-cols-1 gap-3 text-xs sm:grid-cols-2' },
                        h('div', { className: 'rounded-xl border border-warm-200 bg-white p-3.5' },
                            h('span', { className: 'block text-[11px] text-warm-500' }, 'Sumber Dana Anggaran'),
                            h('strong', { className: 'font-semibold text-warm-900' }, `APBD DPA ${item.dinas} 2026`),
                            h('span', { className: 'mt-0.5 block text-[11px] text-warm-500' }, '(Dana Pemeliharaan Rutin)')),
                        h('div', { className: 'rounded-xl border border-warm-200 bg-white p-3.5' },
                            h('span', { className: 'block text-[11px] text-warm-500' }, 'Realisasi Pengeluaran Anggaran'),
                            h('strong', { className: 'block text-base font-extrabold text-amber-800' }, item.biaya))),
                    h('div', { className: 'space-y-1.5 text-xs' },
                        h('span', { className: 'block font-semibold text-warm-600' }, 'Catatan Penyelesaian Petugas Lapangan:'),
                        h('p', { className: 'rounded-xl border border-warm-200 bg-white p-3.5 leading-relaxed text-warm-700' }, item.catatan)),
                    h('div', { className: 'flex items-center gap-2 pt-1 text-xs text-warm-700' },
                        h('i', { className: 'fa-solid fa-people-group text-amber-700' }),
                        h('span', null, 'Tim Pelaksana: ', h('strong', { className: 'text-warm-900' }, `Tim Reaksi Cepat Regu ${item.regu} - ${item.dinas}`))))),
            h('div', { className: 'flex items-center justify-between border-t border-warm-200 bg-warm-50 px-6 py-3.5 text-xs text-warm-600' },
                h('span', { className: 'flex items-center gap-1.5' },
                    h('i', { className: 'fa-solid fa-shield-halved text-xs text-amber-700' }), 'Data Resmi Terverifikasi AksiWarga'),
                h('button', { type: 'button', onClick: onClose, className: 'rounded-xl bg-warm-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-warm-700' }, 'Tutup'))));
}

function BeforeAfterStep({ number, title, description, tag, icon, completed }) {
    return h('div', { className: 'min-w-0 flex-1 rounded-2xl bg-white p-8 shadow-[0_8px_30px_rgba(80,50,20,.08)]' },
        h('div', { className: `grid h-10 w-10 place-items-center rounded-full text-[15px] font-bold ${completed ? 'bg-[#e0f0e5] text-[#3f8a5a]' : 'bg-[#fbeedd] text-[#c4833f]'}` }, number),
        h('h3', { className: 'mt-5 text-base font-bold text-[#2f1d10]' }, title),
        h('p', { className: 'mt-2 text-[13px] leading-relaxed text-[#7c6b5c]' }, description),
        h('span', { className: `mt-5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold ${completed ? 'bg-[#e3f1e7] text-[#3f7a52]' : 'bg-[#fbeedd] text-[#b0702c]'}` },
            h('i', { className: icon }), tag));
}

function BeforeAfterPage() {
    const [openedItem, setOpenedItem] = useState(null);
    const [ticket, setTicket] = useState('');
    const [message, setMessage] = useState('');
    const checkTicket = (event) => {
        event.preventDefault();
        const normalizedTicket = ticket.replace(/[#\s]/g, '').toUpperCase();
        const match = BA_ITEMS.find((item) => item.tiket.replace(/[#\s]/g, '').toUpperCase() === normalizedTicket);
        if (!normalizedTicket) {
            setMessage('Masukkan nomor tiket terlebih dahulu.');
            return;
        }
        if (!match) {
            setMessage('Nomor tiket tidak ditemukan. Periksa kembali nomor pada bukti pengaduan Anda.');
            return;
        }
        setMessage('');
        setOpenedItem(match);
    };

    return h('div', { className: 'before-after-root font-sans antialiased' },
        h('section', { className: 'ba-section bg-[#faf8f4] px-5 py-24', id : 'hasil' },
            h('div', { className: 'mx-auto max-w-6xl' },
                h('div', { className: 'text-center' },
                    h(BeforeAfterEyebrow, null, 'Bukti Nyata Perubahan'),
                    h(BeforeAfterHeading, null, 'Sebelum & Sesudah'),
                    h(BeforeAfterSub, null, 'Dokumentasi visual perubahan nyata dari setiap pengaduan warga yang telah diselesaikan oleh instansi terkait.'),),
                h('div', { className: 'mb-3 mt-7 flex justify-end' },
                    h('a', { href: BEFORE_AFTER_ALL_URL, className: 'text-[13px] font-bold text-[#2f1d10] transition hover:text-[#c4833f]' }, 'Lihat Semua')),
                h('div', { className: 'grid items-start gap-6 md:grid-cols-2 lg:grid-cols-3' },
                    BA_ITEMS.map((item) => h(BeforeAfterCard, { key: item.no, item, onOpen: setOpenedItem }))))),
        h('section', { className: 'ba-section bg-gradient-to-b from-[#fdf2e4] to-[#faf7f1] border-b border-[#efe6d8] px-5 py-20' },
            h('div', { className: 'mx-auto max-w-3xl text-center' },
                h(BeforeAfterEyebrow, null, 'Lacak Status'),
                h(BeforeAfterHeading, { className: 'text-[40px]' }, 'Lacak Progres Laporan Anda'),
                h(BeforeAfterSub, null, 'Masukkan nomor tiket aduan unik yang Anda terima untuk memantau proses verifikasi dan durasi pengerjaan instansi.'),
                h('form', { className: 'mt-9 flex items-center overflow-hidden rounded-xl bg-white shadow-[0_8px_28px_rgba(120,80,30,.12)]', onSubmit: checkTicket, noValidate: true },
                    h('i', { className: 'fa-solid fa-magnifying-glass ml-5 mr-3 text-sm text-[#b3a698]' }),
                    h('input', {
                        value: ticket, onChange: (event) => { setTicket(event.target.value); setMessage(''); },
                        'aria-label': 'Nomor tiket', placeholder: 'Masukan Nomor Tiket',
                        className: 'h-14 min-w-0 flex-1 bg-transparent text-sm text-[#2f1d10] outline-none placeholder:text-[#b9ad9f]',
                    }),
                    h('button', { type: 'submit', className: 'h-14 shrink-0 bg-[#c4833f] px-8 text-sm font-semibold text-white transition hover:bg-[#ad6f2f]' }, 'Cek Status')),
                h('p', { role: message ? 'alert' : undefined, className: `mt-7 text-xs ${message ? 'font-medium text-[#b42318]' : 'text-[#b0a394]'}` },
                    message || 'Gunakan nomor tiket yang Anda terima saat mengirim pengaduan.'))),
        h('section', { className: 'ba-section bg-[#f6f4ef] px-5 py-20' },
            h('div', { className: 'mx-auto max-w-3xl text-center' },
                h(BeforeAfterEyebrow, null, 'Panduan'),
                h(BeforeAfterHeading, { className: 'text-4xl' }, 'Bagaimana TransparansiWarga Bekerja?'),
                h(BeforeAfterSub, null, 'Langkah sederhana berpartisipasi menciptakan perubahan publik yang akuntabel.')),
            h('div', { className: 'mx-auto mt-14 flex max-w-[1232px] flex-col gap-5 md:flex-row md:gap-0' },
                h(BeforeAfterStep, { number: '1', title: 'Laporkan Masalah', description: 'Ambil foto bukti masalah publik, beri titik lokasi presisi, dan pilih instansi/kategori terkait.', tag: 'Unggah Foto & Deskripsi', icon: 'fa-solid fa-camera' }),
                h('div', { className: 'hidden w-[76px] shrink-0 place-items-center self-start mt-6 text-sm text-[#c9bdae] md:grid' }, h('i', { className: 'fa-solid fa-arrow-right' })),
                h(BeforeAfterStep, { number: '2', title: 'Pantau Batas SLA', description: 'Sistem memantau durasi pengerjaan instansi. Jika terlambat, laporan otomatis ditandai merah (Overdue).', tag: 'Pantau Via Nomor Tiket', icon: 'fa-regular fa-clock', completed: true }),
                h('div', { className: 'hidden w-[76px] shrink-0 place-items-center self-start mt-6 text-sm text-[#c9bdae] md:grid' }, h('i', { className: 'fa-solid fa-arrow-right' })),
                h(BeforeAfterStep, { number: '3', title: 'Verifikasi Warga', description: 'Setelah laporan dinyatakan selesai oleh instansi, berikan ulasan dan penilaian atas penyelesaian yang diberikan.', tag: 'Beri Ulasan & Penilaian', icon: 'fa-regular fa-circle-check' }))),
        openedItem && h(BeforeAfterModal, { item: openedItem, onClose: () => setOpenedItem(null) }));
}


function HomePage({ theme, setTheme }) {const [menuOpen, setMenuOpen] = useState(false);
    const onLight = useOnLight();
    const afterHero = useAfterHero();

    useEffect(() => {
        document.documentElement.style.overflow = menuOpen ? 'hidden' : '';
        const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [menuOpen]);

    return h(Fragment, null,
        h(Header, { open: menuOpen, light: onLight, afterHero, setOpen: setMenuOpen, theme, setTheme }),
        h(Island, { hidden: menuOpen, onNavigate: () => setMenuOpen(false) }),
        h(MenuPanel, { open: menuOpen, setOpen: setMenuOpen }),
        h('main', null,
            h(Hero),
            h(Stats),
            h(Peta),
            h(Kinerja),
            h(BeforeAfterPage)),
        h('footer', { className: 'site-footer' },
            h('strong', null, 'AksiWarga'),
            h('p', null, 'Transparansi layanan publik dimulai dari suara warga.'),
            h('small', null, '© 2026 AksiWarga. Semua hak dilindungi.')));
}

function StandalonePage({ title, children }) {
    return h('main', { className: 'standalone-page' },
        h('section', { className: 'standalone-card' },
            h('h1', null, title),
            h('p', null, children),
            h('a', { href: '/', className: 'back-home' }, 'Kembali ke beranda')));
}

function ProfilePage() {
    const { user } = useAuth();
    return h(StandalonePage, { title: `Halo, ${user.name}`, children: `Profil akun ${user.email} akan disiapkan di halaman ini.` });
}

function CreateReportPage() {
    return h(StandalonePage, { title: 'Buat Laporan', children: 'Formulir laporan hanya dapat dibuka setelah login. Formulir akan disiapkan di halaman ini.' });
}

function App() {
    const [theme, setTheme] = useState(() => {
        const savedTheme = window.location.protocol === 'file:' ? null : window.localStorage.getItem('aksiwarga-theme');
        return savedTheme === 'dark' ? 'dark' : 'light';
    });

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        if (window.location.protocol !== 'file:') window.localStorage.setItem('aksiwarga-theme', theme);
    }, [theme]);

    return h(AuthProvider, null,
        h(AppRouter, null,
            h(Routes, null,
                h(Route, { path: '/', element: h(HomePage, { theme, setTheme }) }),
                h(Route, { path: '/transparansi-anggaran', element: h(StandalonePage, { title: 'Transparansi Anggaran', children: 'Informasi transparansi anggaran akan ditampilkan di halaman ini.' }) }),
                h(Route, { path: '/cek-laporan', element: h(StandalonePage, { title: 'Cek Laporan', children: 'Fitur pelacakan laporan akan disiapkan di halaman ini.' }) }),
                h(Route, { element: h(ProtectedRoute) },
                    h(Route, { path: '/buat-laporan', element: h(CreateReportPage) }),
                    h(Route, { path: '/profil', element: h(ProfilePage) })),
                h(Route, { path: '*', element: h(Navigate, { to: '/', replace: true }) }))));
}

ReactDOM.createRoot(document.getElementById('root')).render(h(App));
