(() => {
'use strict';

const BANDS = Object.freeze([
  { min: 85, key: 'sangat-baik', label: 'Sangat baik', color: '#35a66f' },
  { min: 70, key: 'baik', label: 'Baik', color: '#438bd1' },
  { min: 55, key: 'perhatian', label: 'Perlu perhatian', color: '#e7b83f' },
  { min: 0, key: 'kritis', label: 'Kritis', color: '#d9534f' }
]);
const CATEGORIES = ['Infrastruktur & Jalan', 'Lingkungan & Sampah', 'Fasilitas Umum & PJU', 'Air Bersih & Drainase', 'Kesehatan & Pendidikan', 'Layanan Administrasi'];
const AUDIT_LABELS = Object.freeze({ WTP: 'Wajar Tanpa Pengecualian', WDP: 'Wajar Dengan Pengecualian', TW: 'Tidak Wajar', TMP: 'Tidak Memberikan Pendapat' });
const NON_ADMIN = new Set(['12.88', '13.88', '16.88', '18.88', '32.88', '33.88', '33.99', '71.88']);

const bandFor = (sla) => BANDS.find((b) => sla >= b.min);
const fmtInt = (n) => Math.round(Number(n) || 0).toLocaleString('id-ID');
const fmtPct = (n) => `${(Number(n) || 0).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const fmtDays = (n) => `${Number(n).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} hari`;
const fmtRp = (v) => v >= 1e12
  ? `Rp${(v / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 2 })} triliun`
  : `Rp${Math.round(v / 1e9).toLocaleString('id-ID')} miliar`;

function codeFromPcode(pcode) {
  const m = /^ID(\d{2})(\d{2})$/.exec(String(pcode || ''));
  return m ? `${m[1]}.${m[2]}` : null;
}

// Decodes TopoJSON into SVG paths in lon/-lat space (y flipped, so no extra transform is needed).
function topologyToFeatures(topology) {
  if (!topology || !topology.objects || !topology.arcs || !topology.transform) throw new Error('Invalid Indonesia TopoJSON');
  const geometries = topology.objects[Object.keys(topology.objects)[0]].geometries;
  const [sx, sy] = topology.transform.scale, [tx, ty] = topology.transform.translate;
  const cache = new Map();
  function arcAt(i) {
    const rev = i < 0, k = rev ? ~i : i;
    let c = cache.get(k);
    if (!c) {
      let x = 0, y = 0;
      c = topology.arcs[k].map((p) => { x += p[0]; y += p[1]; return [x * sx + tx, -(y * sy + ty)]; });
      cache.set(k, c);
    }
    return rev ? c.slice().reverse() : c;
  }
  let bb;
  function ring(ix) {
    const pts = [];
    for (const i of ix) { const a = arcAt(i); for (let k = pts.length ? 1 : 0; k < a.length; k++) pts.push(a[k]); }
    if (pts.length < 3) return '';
    for (const [x, y] of pts) { if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (x > bb[2]) bb[2] = x; if (y > bb[3]) bb[3] = y; }
    return `M${pts.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join('L')}Z`;
  }
  const poly = (rings) => rings.map(ring).join('');
  const out = [];
  for (const g of geometries) {
    const p = g.properties || {};
    const code = codeFromPcode(p.adm2_pcode);
    if (!code || NON_ADMIN.has(code) || code.endsWith('.88') || code.endsWith('.99')) continue;
    bb = [Infinity, Infinity, -Infinity, -Infinity];
    const path = g.type === 'Polygon' ? poly(g.arcs) : g.type === 'MultiPolygon' ? g.arcs.map(poly).join('') : '';
    if (path) out.push({ code, path, bbox: bb });
  }
  return out;
}

// Deterministic PRNG so each region keeps stable numbers for a given seed.
function rngFor(code, seed) {
  let h = 2166136261 ^ seed;
  for (const c of code) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generates complaint-handling and APBD dummy data for every region. Replace with API data in production.
function buildDataset(regions, seed = 1) {
  const rows = new Map(), provinces = new Map(), nat = { total: 0, done: 0, proc: 0, wait: 0 };
  for (const r of regions) {
    const rnd = rngFor(r.code, seed), kota = r.tier === 'kota';
    const total = Math.round((250 + rnd() * 1900) * (kota ? 1.5 : 1) * (0.6 + rnd() * 0.8));
    const sla = Math.min(0.98, Math.max(0.42, 0.52 + rnd() * 0.3 + rnd() * 0.17));
    const done = Math.round(total * sla);
    const proc = Math.round((total - done) * (0.3 + rnd() * 0.35));
    const wait = total - done - proc;
    const pagu = Math.round((60 + rnd() * 900) * (kota ? 1.6 : 1)) * 1e9;
    const serap = Math.min(0.99, Math.max(0.3, 0.3 + sla * 0.45 + rnd() * 0.25));
    const v = sla + (rnd() - 0.5) * 0.5;
    const audit = v > 0.62 ? 'WTP' : v > 0.5 ? 'WDP' : v > 0.44 ? 'TW' : 'TMP';
    const w = CATEGORIES.map((_, i) => (i === 0 ? 1.6 : 0.5) + rnd() * 1.2);
    const ws = w.reduce((s, x) => s + x, 0);
    const cats = CATEGORIES.map((name, i) => { const count = Math.round((total * w[i]) / ws); return { name, count, pct: (count / total) * 100 }; }).sort((a, b) => b.count - a.count);
    const days = Math.round((1 + (1 - sla) * 7 + rnd() * 1.5) * 10) / 10;
    rows.set(r.code, { ...r, total, done, proc, wait, sla: (done / total) * 100, days, pagu, real: pagu * serap, serap: serap * 100, audit, cats });
    const p = provinces.get(r.province) || { total: 0, done: 0, count: 0 };
    p.total += total; p.done += done; p.count++;
    provinces.set(r.province, p);
    nat.total += total; nat.done += done; nat.proc += proc; nat.wait += wait;
  }
  provinces.forEach((p) => { p.sla = (p.done / p.total) * 100; });
  nat.sla = (nat.done / nat.total) * 100; nat.count = rows.size;
  return { rows, list: [...rows.values()], provinces, national: nat };
}

const AksiCore = { BANDS, CATEGORIES, AUDIT_LABELS, bandFor, buildDataset, topologyToFeatures, codeFromPcode, fmtInt, fmtPct, fmtDays, fmtRp };
if (typeof module !== 'undefined' && module.exports) module.exports = AksiCore;
if (typeof window !== 'undefined') window.AksiCore = AksiCore;
})();
