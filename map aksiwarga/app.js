'use strict';

(function () {
  const h = React.createElement;
  const { useState, useMemo, useRef, useEffect, useCallback, memo } = React;
  const C = window.AksiCore, GEO = window.AKSIWARGA_GEO;
  const PANEL = 400;
  const COMPARE_COLORS = ['#e7a65a', '#76b8a2', '#cf8192', '#8aa6df', '#c0a266'];
  const USER_LOCATION_CODE = '31.75';
  const REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const normalizeSearch = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('id-ID').trim();

  const Paths = memo(function Paths({ features, rows, onPick }) {
    return h('g', null, features.map((f) => {
      const r = rows.get(f.code);
      return h('path', { key: f.code, d: f.path, className: 'reg', 'data-c': f.code, fill: r ? C.bandFor(r.sla).color : '#3a3d44', onClick: onPick });
    }));
  });

  function SearchBar({ regions, onSelect }) {
    const root = useRef(null), input = useRef(null);
    const [query, setQuery] = useState(''), [open, setOpen] = useState(false), [active, setActive] = useState(0);
    const searchable = useMemo(() => regions.map((region) => {
      const label = region.name.replace(/^(Kota|Kabupaten)\s+/i, '');
      return { ...region, label, nameKey: normalizeSearch(region.name), labelKey: normalizeSearch(label), provinceKey: normalizeSearch(region.province) };
    }), [regions]);
    const location = searchable.find((region) => region.code === USER_LOCATION_CODE);
    const matches = query.trim()
      ? searchable.map((region) => ({
        region,
        rank: region.labelKey.startsWith(normalizeSearch(query)) || region.nameKey.startsWith(normalizeSearch(query)) ? 0
          : region.labelKey.includes(normalizeSearch(query)) || region.nameKey.includes(normalizeSearch(query)) ? 1
            : region.provinceKey.includes(normalizeSearch(query)) ? 2 : 3
      })).filter((item) => item.rank < 3)
        .sort((a, b) => a.rank - b.rank || a.region.label.localeCompare(b.region.label, 'id'))
        .slice(0, 7).map((item) => item.region)
      : [];
    const options = query.trim() ? matches : location ? [location] : [];
    useEffect(() => {
      const dismiss = (event) => { if (!root.current.contains(event.target)) setOpen(false); };
      document.addEventListener('pointerdown', dismiss);
      return () => document.removeEventListener('pointerdown', dismiss);
    }, []);
    const choose = (region) => {
      if (!region) return;
      setQuery('');
      setOpen(false);
      setActive(0);
      onSelect(region.code);
    };
    const onKeyDown = (event) => {
      if (event.key === 'ArrowDown' && options.length) {
        event.preventDefault();
        setActive((index) => (index + 1) % options.length);
      } else if (event.key === 'ArrowUp' && options.length) {
        event.preventDefault();
        setActive((index) => (index - 1 + options.length) % options.length);
      } else if (event.key === 'Enter' && open) {
        event.preventDefault();
        choose(options[active]);
      } else if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    return h('div', { className: 'search', ref: root },
      h('span', { className: 'search-icon', 'aria-hidden': 'true' }, '⌕'),
      h('input', {
        ref: input,
        type: 'search',
        value: query,
        placeholder: 'Cari kabupaten/kota...',
        role: 'combobox',
        'aria-label': 'Cari kabupaten atau kota',
        'aria-autocomplete': 'list',
        'aria-expanded': open,
        onFocus: () => { setOpen(true); setActive(0); },
        onPointerDown: () => { setOpen(true); setActive(0); },
        onChange: (event) => { setQuery(event.target.value); setOpen(true); setActive(0); },
        onKeyDown
      }),
      query && h('button', { className: 'search-clear', onClick: () => { setQuery(''); setOpen(true); input.current.focus(); }, 'aria-label': 'Hapus pencarian' }, '×'),
      open && h('div', { className: 'search-dropdown', role: 'listbox' },
        !query.trim()
          ? location && h('button', { className: `search-option location-option${active === 0 ? ' active' : ''}`, role: 'option', 'aria-selected': active === 0, onMouseEnter: () => setActive(0), onMouseDown: (event) => event.preventDefault(), onClick: () => choose(location) },
            h('span', { className: 'location-icon', 'aria-hidden': 'true' }, '⌖'),
            h('span', null, h('strong', null, 'Daerah di lokasiku'), h('small', null, `${location.label} · lokasi sementara`)))
          : options.length
            ? options.map((region, index) => h('button', { className: `search-option${active === index ? ' active' : ''}`, key: region.code, role: 'option', 'aria-selected': active === index, onMouseEnter: () => setActive(index), onMouseDown: (event) => event.preventDefault(), onClick: () => choose(region) },
              h('span', { className: 'result-pin', 'aria-hidden': 'true' }, '⌖'),
              h('span', null, h('strong', null, region.label), h('small', null, `${region.tier === 'kota' ? 'Kota' : 'Kabupaten'} · ${region.province}`))))
            : h('p', { className: 'search-empty' }, 'Daerah tidak ditemukan.')));
  }

  function Tip({ row, x, y, w }) {
    const stats = [['Total laporan', row.total], ['Selesai', row.done], ['Dalam proses', row.proc], ['Belum ditanggapi', row.wait]];
    return h('div', { className: 'tip', style: { left: x > w - 250 ? x - 234 : x + 14, top: y + 14 } },
      h('h4', null, row.name), h('p', { className: 'sub' }, row.province),
      h('dl', null, stats.flatMap(([k, v]) => [h('dt', { key: k }, k), h('dd', { key: k + 'v' }, C.fmtInt(v))])));
  }

  function MapView({ features, rows, selected, compareCodes, onSelect, selectionVersion, homeRequest }) {
    const wrap = useRef(null), vr = useRef(null), anim = useRef(0), moved = useRef(false);
    const [view, setView] = useState(null), [size, setSize] = useState({ w: 0, h: 0 }), [tip, setTip] = useState(null);
    const byCode = useMemo(() => new Map(features.map((f) => [f.code, f])), [features]);
    const bounds = useMemo(() => features.reduce((b, f) => [Math.min(b[0], f.bbox[0]), Math.min(b[1], f.bbox[1]), Math.max(b[2], f.bbox[2]), Math.max(b[3], f.bbox[3])], [1e9, 1e9, -1e9, -1e9]), [features]);
    const asp = size.w ? size.h / size.w : 0.6;
    const apply = useCallback((v) => { vr.current = v; setView(v); }, []);
    const fit = () => ({ cx: (bounds[0] + bounds[2]) / 2, cy: (bounds[1] + bounds[3]) / 2, w: Math.max(bounds[2] - bounds[0], (bounds[3] - bounds[1]) / asp) * 1.06 });

    // Animasi halus (ease in-out) ke tampilan target.
    const flyTo = (t) => {
      cancelAnimationFrame(anim.current);
      const a = vr.current, t0 = performance.now(), D = REDUCE ? 0 : 650;
      const step = (now) => {
        const k = D ? Math.min(1, (now - t0) / D) : 1, e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        apply({ cx: a.cx + (t.cx - a.cx) * e, cy: a.cy + (t.cy - a.cy) * e, w: a.w * Math.pow(t.w / a.w, e) });
        if (k < 1) anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    };

    useEffect(() => {
      const rect = wrap.current.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
      const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
      ro.observe(wrap.current);
      return () => ro.disconnect();
    }, []);
    useEffect(() => { if (size.w && !vr.current) apply(fit()); }, [size.w, size.h]);
    useEffect(() => { if (homeRequest && size.w) flyTo(fit()); }, [homeRequest, size.w, size.h]);

    // Zoom dengan scroll wheel, berpusat pada posisi kursor.
    useEffect(() => {
      const el = wrap.current;
      const onWheel = (e) => {
        e.preventDefault();
        const v = vr.current; if (!v) return;
        cancelAnimationFrame(anim.current);
        const r = el.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height, a = r.height / r.width;
        const w = clamp(v.w * Math.exp(clamp(e.deltaY, -100, 100) * 0.0015), 0.25, 70);
        const px = v.cx + (fx - 0.5) * v.w, py = v.cy + (fy - 0.5) * v.w * a;
        apply({ w, cx: px - (fx - 0.5) * w, cy: py - (fy - 0.5) * w * a });
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    }, []);

    // Auto-zoom ke wilayah terpilih, digeser agar tidak tertutup panel kiri.
    useEffect(() => {
      const f = selected && byCode.get(selected);
      if (!f || !vr.current) return;
      const side = size.w > 820 ? PANEL : 0, vis = (size.w - side) / size.w, b = f.bbox;
      const w = clamp(Math.max(((b[2] - b[0]) * 2.5) / vis, ((b[3] - b[1]) * 2.5) / asp), 0.9, 70);
      flyTo({ cx: (b[0] + b[2]) / 2 - ((side / 2) / size.w) * w, cy: (b[1] + b[3]) / 2, w });
    }, [selected, selectionVersion, size.w, size.h]);

    // Pan: tahan klik kiri lalu geser.
    const onDown = (e) => {
      if (e.button !== 0) return;
      cancelAnimationFrame(anim.current);
      const s = { x: e.clientX, y: e.clientY, v: vr.current };
      moved.current = false;
      const mv = (ev) => {
        const dx = ev.clientX - s.x, dy = ev.clientY - s.y;
        if (!moved.current && Math.hypot(dx, dy) < 5) return;
        moved.current = true; setTip(null);
        const k = s.v.w / wrap.current.getBoundingClientRect().width;
        apply({ ...s.v, cx: s.v.cx - dx * k, cy: s.v.cy - dy * k });
      };
      const up = () => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
        setTimeout(() => { moved.current = false; }, 0);
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    };
    const onMove = (e) => {
      const c = e.target.dataset && e.target.dataset.c;
      if (!c || e.buttons) return setTip(null);
      const r = wrap.current.getBoundingClientRect();
      setTip({ c, x: e.clientX - r.left, y: e.clientY - r.top });
    };
    const pick = useCallback((e) => { if (!moved.current) onSelect(e.currentTarget.dataset.c); }, [onSelect]);
    const zoomBy = (f) => flyTo({ ...vr.current, w: clamp(vr.current.w * f, 0.25, 70) });
    const vb = view ? `${view.cx - view.w / 2} ${view.cy - (view.w * asp) / 2} ${view.w} ${view.w * asp}` : '0 0 1 1';
    const tipRow = tip && rows.get(tip.c), selF = selected && byCode.get(selected);
    const markerRadius = size.w ? (view ? view.w : 1) * 14 / size.w : 0;

    return h('div', { className: 'map', ref: wrap, onPointerDown: onDown, onMouseMove: onMove, onMouseLeave: () => setTip(null) },
      view && h('svg', { viewBox: vb, role: 'img', 'aria-label': 'Peta kabupaten dan kota Indonesia' },
        h(Paths, { features, rows, onPick: pick }),
        tip && h('path', { d: byCode.get(tip.c).path, className: 'hov' }),
        selF && h('path', { d: selF.path, className: 'selo' }),
        compareCodes.map((code, i) => {
          const f = byCode.get(code);
          if (!f) return null;
          const x = (f.bbox[0] + f.bbox[2]) / 2, y = (f.bbox[1] + f.bbox[3]) / 2;
          return h('g', { key: code, className: 'compare-marker', style: { '--compare-color': COMPARE_COLORS[i] } },
            h('path', { d: f.path }),
            h('circle', { cx: x, cy: y, r: markerRadius }),
            h('text', { x, y, dy: '0.35em', textAnchor: 'middle', fontSize: markerRadius * 0.95 }, String(i + 1)));
        })),
      tipRow && h(Tip, { row: tipRow, x: tip.x, y: tip.y, w: size.w }),
      h('div', { className: 'zoom', onPointerDown: (e) => e.stopPropagation() },
        h('button', { className: 'icon', onClick: () => zoomBy(0.6), 'aria-label': 'Perbesar' }, '+'),
        h('button', { className: 'icon', onClick: () => zoomBy(1 / 0.6), 'aria-label': 'Perkecil' }, '−'),
        h('button', { className: 'icon', onClick: () => flyTo(fit()), 'aria-label': 'Tampilkan seluruh Indonesia', title: 'Seluruh Indonesia' }, '⌂')));
  }

  const Stat = (label, v, color) => h('div', { className: 'stat', style: { '--k': color } }, h('b', null, C.fmtInt(v)), h('span', null, label));
  const KV = (k, v) => h('div', { className: 'kv' }, h('span', null, k), h('b', null, v));

  function Panel({ row, prov, onClose, onCompare }) {
    const band = C.bandFor(row.sla), auditColor = row.audit === 'WTP' ? '#5aa386' : row.audit === 'WDP' ? '#e0a458' : '#b2453d';
    return h('aside', { className: 'panel', 'aria-label': 'Detail wilayah' },
      h('div', { className: 'ptop' },
        h('button', { className: 'btn amber', onClick: onCompare }, '+ Bandingkan'),
        h('button', { className: 'icon', onClick: onClose, 'aria-label': 'Tutup panel' }, '×')),
      h('h2', null, row.name),
      h('p', { className: 'sub' }, `${row.tier === 'kota' ? 'Kota' : 'Kabupaten'} di Provinsi ${row.province}`),
      h('span', { className: 'badge', style: { '--c': band.color } }, h('b', null, `SLA ${C.fmtPct(row.sla)}`), band.label),
      h('div', { className: 'grid4' }, Stat('Total', row.total, '#a09b8c'), Stat('Selesai', row.done, '#5aa386'), Stat('Proses', row.proc, '#e0a458'), Stat('Belum ditanggapi', row.wait, '#b2453d')),
      KV('Rata-rata waktu penanganan', C.fmtDays(row.days)),
      KV(`Provinsi ${row.province}`, `${C.fmtPct(prov.sla)} selesai dari ${C.fmtInt(prov.total)} laporan`),
      h('h3', null, 'Kategori masalah utama'),
      row.cats.slice(0, 5).map((c) => h('div', { className: 'meter', key: c.name },
        h('div', null, h('span', null, c.name), h('small', null, `${C.fmtInt(c.count)} laporan, ${C.fmtPct(c.pct)}`)),
        h('div', { className: 'track' }, h('i', { style: { width: `${c.pct}%` } })))),
      h('h3', null, 'Anggaran APBD infrastruktur'),
      KV('Total pagu', C.fmtRp(row.pagu)), KV('Dana terealisasi', C.fmtRp(row.real)),
      h('div', { className: 'meter', style: { marginTop: '.7rem' } },
        h('div', null, h('span', null, 'Serapan anggaran'), h('small', null, C.fmtPct(row.serap))),
        h('div', { className: 'track' }, h('i', { style: { width: `${row.serap}%` } }))),
      h('div', { className: 'audit', style: { '--c': auditColor } }, 'Status audit BPK: ', h('b', null, `${row.audit} (${C.AUDIT_LABELS[row.audit]})`)),
      h('div', { className: 'acts' },
        h('a', { className: 'btn', href: `/laporan?wilayah=${row.code}` }, 'Lihat Semua Laporan Daerah Ini')));
  }

  // better: 1 = lebih tinggi lebih baik, -1 = lebih rendah lebih baik, 0 = tanpa penilaian
  const COMPARE = [
    ['Total laporan', 'total', C.fmtInt, 0], ['Laporan selesai', 'done', C.fmtInt, 0], ['Laporan dalam proses', 'proc', C.fmtInt, 0],
    ['Belum ditanggapi', 'wait', C.fmtInt, 0], ['Tingkat penyelesaian (SLA)', 'sla', C.fmtPct, 1], ['Rata-rata waktu penanganan', 'days', C.fmtDays, -1],
    ['Pagu APBD infrastruktur', 'pagu', C.fmtRp, 0], ['Dana terealisasi', 'real', C.fmtRp, 0], ['Serapan APBD', 'serap', C.fmtPct, 1], ['Audit BPK', 'audit', (v) => v, 0]
  ];

  function ComparePicker({ codes, rows, notice, onRemove, onCancel, onShow }) {
    return h('section', { className: 'compare-picker', 'aria-label': 'Daerah untuk dibandingkan', onPointerDown: (e) => e.stopPropagation() },
      h('div', { className: 'picker-head' },
        h('div', null, h('strong', null, 'Pilih daerah pembanding'), h('span', null, 'Klik wilayah di peta · maksimal 5')),
        h('button', { className: 'icon', onClick: onCancel, 'aria-label': 'Batal membandingkan', title: 'Batal' }, '×')),
      codes.length
        ? h('div', { className: 'compare-chips' }, codes.map((code, i) => {
          const row = rows.get(code);
          return h('div', { className: 'compare-chip', key: code, style: { '--compare-color': COMPARE_COLORS[i] } },
            h('b', { className: 'chip-number' }, i + 1),
            h('span', { className: 'chip-label' }, h('strong', null, row.name), h('small', null, row.province)),
            h('button', { className: 'chip-remove', onClick: () => onRemove(code), 'aria-label': `Hapus ${row.name}`, title: 'Hapus wilayah' }, '×'));
        }))
        : h('p', { className: 'picker-empty' }, 'Pilih wilayah pada peta untuk mulai membandingkan.'),
      h('div', { className: 'picker-foot' },
        h('span', { 'aria-live': 'polite' }, notice || (codes.length < 2 ? 'Pilih minimal 2 wilayah.' : `${codes.length} wilayah siap dibandingkan.`)),
        h('button', { className: 'btn amber', onClick: onShow, disabled: codes.length < 2 }, 'Lihat Perbandingan')));
  }

  function Compare({ selectedRows, onClose }) {
    const win = (key, dir, row) => dir !== 0 && !selectedRows.some((other) => {
      if (other.code === row.code) return false;
      return dir > 0 ? other[key] > row[key] : other[key] < row[key];
    });
    return h('div', { className: 'scrim', onClick: (e) => e.target === e.currentTarget && onClose() },
      h('div', { className: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Perbandingan wilayah' },
        h('div', { className: 'mhead' },
          h('div', null, h('h2', null, 'Perbandingan wilayah'), h('p', { className: 'compare-subtitle' }, `${selectedRows.length} kabupaten/kota · geser tabel ke samping · nilai terbaik disorot`)),
          h('button', { className: 'icon', onClick: onClose, autoFocus: true, 'aria-label': 'Kembali ke pilihan wilayah' }, '×')),
        h('div', { className: 'table-wrap' },
          h('table', { className: 'compare-table' },
            h('thead', null, h('tr', null,
              h('th', { className: 'metric-head' }, 'Indikator'),
              selectedRows.map((row, i) => h('th', { key: row.code, className: 'region-head', style: { '--compare-color': COMPARE_COLORS[i] } },
                h('span', { className: 'region-number' }, i + 1), h('strong', null, row.name), h('small', null, row.province))))),
            h('tbody', null, COMPARE.map(([label, key, fmt, dir]) => h('tr', { key },
              h('th', { scope: 'row' }, label),
              selectedRows.map((row) => h('td', { key: row.code, className: win(key, dir, row) ? 'win' : '' },
                fmt(row[key]), win(key, dir, row) && h('span', { className: 'best-label' }, 'Terbaik'))))))))));
  }

  function App() {
    const requestedRegion = new URLSearchParams(window.location.search).get('wilayah');
    const initialRegion = GEO.regions.some((region) => region.code === requestedRegion) ? requestedRegion : null;
    const [sel, setSel] = useState(initialRegion), [cmp, setCmp] = useState(false);
    const [selectingCompare, setSelectingCompare] = useState(false), [compareCodes, setCompareCodes] = useState([]), [compareNotice, setCompareNotice] = useState('');
    const [theme, setTheme] = useState('dark'), [selectionVersion, setSelectionVersion] = useState(0), [homeRequest, setHomeRequest] = useState(0);
    const features = useMemo(() => C.topologyToFeatures(GEO.topology), []);
    const ds = useMemo(() => C.buildDataset(GEO.regions), []);
    const row = sel && ds.rows.get(sel);
    const openRegion = (code) => {
      setSelectingCompare(false);
      setCompareCodes([]);
      setCompareNotice('');
      setCmp(false);
      setSel(code);
      setSelectionVersion((version) => version + 1);
    };
    const selectRegion = (code) => {
      if (!selectingCompare) { setSel(code); setSelectionVersion((version) => version + 1); return; }
      if (compareCodes.includes(code)) return;
      if (compareCodes.length >= 5) { setCompareNotice('Maksimal 5 wilayah. Hapus salah satu pilihan untuk menggantinya.'); return; }
      setCompareCodes((current) => current.includes(code) ? current : [...current, code]);
      setCompareNotice('');
    };
    const startCompare = () => {
      if (row) setCompareCodes([row.code]);
      setCompareNotice('');
      setCmp(false);
      setSelectingCompare(true);
      setSel(null);
    };
    const cancelCompare = () => {
      setSelectingCompare(false);
      setCompareCodes([]);
      setCompareNotice('');
      setCmp(false);
    };
    const goHome = () => {
      setSel(null);
      setSelectingCompare(false);
      setCompareCodes([]);
      setCompareNotice('');
      setCmp(false);
      setHomeRequest((request) => request + 1);
    };
    useEffect(() => {
      const k = (e) => {
        if (e.key !== 'Escape') return;
        if (cmp) setCmp(false);
        else if (selectingCompare) cancelCompare();
        else setSel(null);
      };
      window.addEventListener('keydown', k);
      return () => window.removeEventListener('keydown', k);
    }, [cmp, selectingCompare]);
    const selectedRows = compareCodes.map((code) => ds.rows.get(code)).filter(Boolean);
    return h('div', { className: `app${theme === 'light' ? ' theme-light' : ''}` },
      h('header', { className: 'top' },
        h('a', { className: 'brand', href: '../index.html', 'aria-label': 'AksiWarga - Beranda' },
          h('img', { src: '../asset/logo%20web.jpg', alt: '', className: 'brand-logo' }),
          h('span', null, 'AksiWarga')),
        h(SearchBar, { regions: GEO.regions, onSelect: openRegion }),
        h('div', { className: 'header-actions' },
          h('button', {
            className: 'icon theme-toggle',
            onClick: () => setTheme((current) => current === 'dark' ? 'light' : 'dark'),
            'aria-label': `Ganti ke tema ${theme === 'dark' ? 'terang' : 'gelap'}`,
            title: `Ganti ke tema ${theme === 'dark' ? 'terang' : 'gelap'}`
          }, h('span', { key: theme, className: 'theme-symbol', 'aria-hidden': 'true' }, theme === 'dark' ? '☼' : '☾')),
          h('button', { className: 'btn home-button', onClick: () => (window.location.href = '../index.html') }, 'Beranda'))),
      h('main', { className: 'stage' },
        h(MapView, { features, rows: ds.rows, selected: sel, compareCodes: selectingCompare ? compareCodes : [], onSelect: selectRegion, selectionVersion, homeRequest }),
        row && h(Panel, { key: row.code, row, prov: ds.provinces.get(row.province), onClose: () => setSel(null), onCompare: startCompare }),
        h('div', { className: 'legend' }, h('p', null, 'Tingkat penyelesaian (SLA)'),
          C.BANDS.map((b, i) => h('div', { key: b.key }, h('i', { style: { '--c': b.color } }), i === 0 ? `${b.min}% atau lebih` : i === C.BANDS.length - 1 ? `Di bawah ${C.BANDS[i - 1].min}%` : `${b.min}% sampai ${C.BANDS[i - 1].min}%`))),
        selectingCompare && h(ComparePicker, {
          codes: compareCodes,
          rows: ds.rows,
          notice: compareNotice,
          onRemove: (code) => { setCompareCodes((current) => current.filter((item) => item !== code)); setCompareNotice(''); },
          onCancel: cancelCompare,
          onShow: () => setCmp(true)
        }),
        cmp && h(Compare, { selectedRows, onClose: () => setCmp(false) })));
  }

  ReactDOM.createRoot(document.getElementById('root')).render(h(App));
})();
