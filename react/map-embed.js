'use strict';

(function () {
    const h = React.createElement;
    const { useEffect, useMemo, useRef, useState } = React;
    const core = window.AksiCore;
    const geo = window.AKSIWARGA_GEO;
    const DETAIL_URL = new URL('../map%20aksiwarga/index.html', document.currentScript.src).href;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function RegionTip({ row, x, y, width }) {
        const stats = [['Total laporan', row.total], ['Selesai', row.done], ['Dalam proses', row.proc], ['Belum ditanggapi', row.wait]];
        return h('div', { className: 'map-embed-tip', style: { left: x > width - 250 ? x - 234 : x + 14, top: y + 14 } },
            h('h4', null, row.name),
            h('p', { className: 'map-embed-sub' }, row.province),
            h('dl', null, stats.flatMap(([label, value]) => [
                h('dt', { key: label }, label),
                h('dd', { key: `${label}-value` }, core.fmtInt(value)),
            ])));
    }

    function IndonesiaMap() {
        const root = useRef(null);
        const viewRef = useRef(null);
        const animationRef = useRef(0);
        const movedRef = useRef(false);
        const [view, setView] = useState(null);
        const [size, setSize] = useState({ width: 0, height: 0 });
        const [tip, setTip] = useState(null);
        const features = useMemo(() => core.topologyToFeatures(geo.topology), []);
        const dataset = useMemo(() => core.buildDataset(geo.regions), []);
        const byCode = useMemo(() => new Map(features.map((feature) => [feature.code, feature])), [features]);
        const bounds = useMemo(() => features.reduce((result, feature) => [
            Math.min(result[0], feature.bbox[0]),
            Math.min(result[1], feature.bbox[1]),
            Math.max(result[2], feature.bbox[2]),
            Math.max(result[3], feature.bbox[3]),
        ], [Infinity, Infinity, -Infinity, -Infinity]), [features]);
        const aspect = size.width ? size.height / size.width : 0.6;

        const applyView = (nextView) => {
            viewRef.current = nextView;
            setView(nextView);
        };
        const fitView = () => ({
            cx: (bounds[0] + bounds[2]) / 2,
            cy: (bounds[1] + bounds[3]) / 2,
            w: Math.max(bounds[2] - bounds[0], (bounds[3] - bounds[1]) / aspect) * 1.06,
        });
        const animateTo = (target) => {
            cancelAnimationFrame(animationRef.current);
            const start = viewRef.current;
            if (!start) {
                applyView(target);
                return;
            }
            const startedAt = performance.now();
            const duration = reducedMotion ? 0 : 650;
            const step = (now) => {
                const progress = duration ? Math.min(1, (now - startedAt) / duration) : 1;
                const eased = progress < 0.5
                    ? 4 * progress ** 3
                    : 1 - ((-2 * progress + 2) ** 3) / 2;
                applyView({
                    cx: start.cx + (target.cx - start.cx) * eased,
                    cy: start.cy + (target.cy - start.cy) * eased,
                    w: start.w * (target.w / start.w) ** eased,
                });
                if (progress < 1) animationRef.current = requestAnimationFrame(step);
            };
            animationRef.current = requestAnimationFrame(step);
        };

        useEffect(() => {
            const element = root.current;
            const resize = () => {
                const rect = element.getBoundingClientRect();
                setSize({ width: rect.width, height: rect.height });
            };
            resize();
            const observer = new ResizeObserver(resize);
            observer.observe(element);
            return () => {
                observer.disconnect();
                cancelAnimationFrame(animationRef.current);
            };
        }, []);

        useEffect(() => {
            if (size.width && !viewRef.current) applyView(fitView());
        }, [size.width, size.height]);

        useEffect(() => {
            const element = root.current;
            const onWheel = (event) => {
                event.preventDefault();
                const current = viewRef.current;
                if (!current) return;
                cancelAnimationFrame(animationRef.current);
                const rect = element.getBoundingClientRect();
                const fx = (event.clientX - rect.left) / rect.width;
                const fy = (event.clientY - rect.top) / rect.height;
                const width = clamp(current.w * Math.exp(clamp(event.deltaY, -100, 100) * 0.0015), 0.25, 70);
                const px = current.cx + (fx - 0.5) * current.w;
                const py = current.cy + (fy - 0.5) * current.w * rect.height / rect.width;
                applyView({
                    w: width,
                    cx: px - (fx - 0.5) * width,
                    cy: py - (fy - 0.5) * width * rect.height / rect.width,
                });
            };
            element.addEventListener('wheel', onWheel, { passive: false });
            return () => element.removeEventListener('wheel', onWheel);
        }, []);

        const startPan = (event) => {
            if (event.button !== 0 || !viewRef.current || event.target.closest('.map-embed-zoom')) return;
            cancelAnimationFrame(animationRef.current);
            const start = { x: event.clientX, y: event.clientY, view: viewRef.current };
            movedRef.current = false;
            const move = (pointerEvent) => {
                const dx = pointerEvent.clientX - start.x;
                const dy = pointerEvent.clientY - start.y;
                if (!movedRef.current && Math.hypot(dx, dy) < 5) return;
                movedRef.current = true;
                setTip(null);
                const width = root.current.getBoundingClientRect().width;
                const scale = start.view.w / width;
                applyView({
                    ...start.view,
                    cx: start.view.cx - dx * scale,
                    cy: start.view.cy - dy * scale,
                });
            };
            const end = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', end);
                setTimeout(() => { movedRef.current = false; }, 0);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', end);
        };

        const onMapMove = (event) => {
            const code = event.target.dataset && event.target.dataset.regionCode;
            if (!code || event.buttons) {
                setTip(null);
                return;
            }
            const rect = root.current.getBoundingClientRect();
            setTip({ code, x: event.clientX - rect.left, y: event.clientY - rect.top });
        };
        const zoomBy = (factor) => {
            if (viewRef.current) animateTo({ ...viewRef.current, w: clamp(viewRef.current.w * factor, 0.25, 70) });
        };
        const viewBox = view
            ? `${view.cx - view.w / 2} ${view.cy - view.w * aspect / 2} ${view.w} ${view.w * aspect}`
            : '0 0 1 1';
        const tipRow = tip && dataset.rows.get(tip.code);

        return h('div', {
            ref: root,
            className: 'map-embed',
            onPointerDown: startPan,
            onMouseMove: onMapMove,
            onMouseLeave: () => setTip(null),
            'aria-label': 'Peta interaktif kabupaten dan kota di Indonesia',
        },
            view && h('svg', { viewBox, role: 'img', 'aria-label': 'Peta kabupaten dan kota Indonesia' },
                h('g', null, features.map((feature) => {
                    const row = dataset.rows.get(feature.code);
                    return h('path', {
                        key: feature.code,
                        d: feature.path,
                        className: 'map-embed-region',
                        'data-region-code': feature.code,
                        fill: row ? core.bandFor(row.sla).color : '#3a3d44',
                        onClick: () => {
                            if (!movedRef.current) window.location.assign(`${DETAIL_URL}?wilayah=${encodeURIComponent(feature.code)}`);
                        },
                    });
                })),
                tip && byCode.get(tip.code) && h('path', { d: byCode.get(tip.code).path, className: 'map-embed-hover' })),
            tipRow && h(RegionTip, { row: tipRow, x: tip.x, y: tip.y, width: size.width }),
            h('div', { className: 'map-embed-zoom', onPointerDown: (event) => event.stopPropagation() },
                h('button', { type: 'button', onClick: () => zoomBy(0.6), 'aria-label': 'Perbesar peta' }, '+'),
                h('button', { type: 'button', onClick: () => zoomBy(1 / 0.6), 'aria-label': 'Perkecil peta' }, '−'),
                h('button', { type: 'button', onClick: () => animateTo(fitView()), 'aria-label': 'Tampilkan seluruh Indonesia', title: 'Seluruh Indonesia' }, '⌂')));
    }

    if (!core || !geo) throw new Error('Data peta Indonesia belum dimuat.');
    window.IndonesiaMap = IndonesiaMap;
})();
