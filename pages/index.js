// pages/index.js
import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';

function parseDate(str) {
  if (!str) return null;
  const m1 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) return new Date(+m1[3], +m1[2] - 1, +m1[1]);
  const m2 = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3]);
  if (/^\d{4,5}$/.test(str.trim())) {
    const serial = parseInt(str.trim());
    return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  }
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

function isToday(date) {
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatDate(date) {
  if (!date) return '—';
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysDiff(date) {
  if (!date) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
}

// FIX 5 — formatMoney más robusto.
// Detecta formato europeo (1.234,56) vs americano (1,234.56) antes de parsear.
// Soporta múltiples símbolos y evita que replace(',','.') rompa con varias comas.
function formatMoney(val) {
  if (val === null || val === undefined || val === '') return '—';
  const str = String(val).trim();
  if (!str || str === '—') return '—';
  const cleaned = str.replace(/[€$£\s]/g, '').trim();
  if (!cleaned) return '—';
  let num;
  if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    // Europeo: "1.234,56" → eliminar puntos de miles, cambiar coma decimal
    num = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  } else if (/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(cleaned)) {
    // Americano: "1,234.56" → eliminar comas de miles
    num = parseFloat(cleaned.replace(/,/g, ''));
  } else {
    // Fallback: reemplazar todas las comas (no solo la primera)
    num = parseFloat(cleaned.replace(/,/g, '.'));
  }
  if (isNaN(num)) return str || '—';
  return num.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

// FIX 4 — Helper de acceso seguro a campos a través de keys.
// Devuelve '—' cuando la clave del mapping o el valor del campo son undefined/null/vacío.
function safeGet(row, key) {
  if (!key) return '—';
  const val = row[key];
  return (val !== undefined && val !== null && String(val).trim() !== '') ? val : '—';
}

// Sonido ENTRADA — ascendente, luminoso (Do→Mi→Sol→Do6)
function playEntrada(ctx) {
  const now = ctx.currentTime;
  [[0, 523, 0.55], [0.18, 659, 0.5], [0.34, 784, 0.65], [0.5, 1047, 0.45]].forEach(([t, freq, vol]) => {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + t);
    gain.gain.setValueAtTime(vol, now + t);
    gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.28);
    osc.start(now + t); osc.stop(now + t + 0.3);
  });
}

// Sonido SALIDA — descendente, suave (Sol→Mi→Do→Sol4)
function playSalida(ctx) {
  const now = ctx.currentTime;
  [[0, 784, 0.45], [0.22, 659, 0.4], [0.42, 523, 0.5], [0.6, 392, 0.35]].forEach(([t, freq, vol]) => {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + t);
    gain.gain.setValueAtTime(vol, now + t);
    gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.32);
    osc.start(now + t); osc.stop(now + t + 0.35);
  });
}

// Dispatcher: toca el sonido correcto según qué tipo de evento hay hoy
function playAlarmFor(ctx, hasIn, hasOut) {
  if (hasIn) playEntrada(ctx);
  if (hasOut) setTimeout(() => playSalida(ctx), hasIn ? 1000 : 0);
}

export default function Home() {
  const [data, setData] = useState([]);
  const [keys, setKeys] = useState({});
  const [detectedCols, setDetectedCols] = useState([]);
  const [showDebug, setShowDebug] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('entrada');
  const [search, setSearch] = useState('');
  const [alarmsEnabled, setAlarmsEnabled] = useState(true);
  const [phones, setPhones] = useState({});
  const [editingPhone, setEditingPhone] = useState(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [called, setCalled] = useState({});
  const [expandedRow, setExpandedRow] = useState(null);
  const [tab, setTab] = useState('reservas');

  const audioCtx = useRef(null);
  const alarmInterval = useRef(null);
  const headerRef = useRef(null);
  const bannerRef = useRef(null);
  const tabsRef = useRef(null);
  const statsRef = useRef(null);
  const controlsRef = useRef(null);

  // FIX 4 — fetchData con sanitización defensiva de keys.
  // Garantiza que todos los valores del mapa sean strings y nunca undefined.
  const fetchData = useCallback(async () => {
    try {
      const r = await fetch('/api/reservas');
      const json = await r.json();
      if (json.error && !json.data) throw new Error(json.error);
      const safeKeys = Object.fromEntries(
        Object.entries(json.keys || {}).map(([k, v]) => [k, typeof v === 'string' ? v : String(v ?? '')])
      );
      setKeys(safeKeys);
      setDetectedCols(json._cols || []);
      const enriched = (json.data || []).map((row, i) => ({
        ...row,
        _id: i,
        _entrada: parseDate(safeKeys.entrada ? row[safeKeys.entrada] : null),
        _salida: parseDate(safeKeys.salida ? row[safeKeys.salida] : null),
        _origen: (safeKeys.origen ? (row[safeKeys.origen] || '') : '').toLowerCase(),
      }));
      setData(enriched);
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const todayIn = data.filter(r => isToday(r._entrada));
  const todayOut = data.filter(r => isToday(r._salida));
  const hasToday = todayIn.length > 0 || todayOut.length > 0;

  // FIX 3 — ResizeObserver con disparo inmediato vía requestAnimationFrame.
  // El :root ya incluye valores por defecto, pero esto los afina en cuanto el DOM esté listo,
  // eliminando el salto visual del primer frame.
  useEffect(() => {
    function measure() {
      const hH = headerRef.current?.offsetHeight   || 0;
      const bH = bannerRef.current?.offsetHeight   || 0;
      const tH = tabsRef.current?.offsetHeight     || 0;
      const sH = statsRef.current?.offsetHeight    || 0;
      const cH = controlsRef.current?.offsetHeight || 0;
      if (hH === 0 && tH === 0) return;
      document.documentElement.style.setProperty('--header-h',     `${hH}px`);
      document.documentElement.style.setProperty('--header-tabs-h',`${hH + bH}px`);
      // --tbl-top = todo lo que está encima del scroll de la tabla
      document.documentElement.style.setProperty('--tbl-top',      `${hH + bH + tH + sH + cH}px`);
    }
    requestAnimationFrame(measure);
    const obs = new ResizeObserver(measure);
    [headerRef, bannerRef, tabsRef, statsRef, controlsRef]
      .forEach(r => r.current && obs.observe(r.current));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    clearInterval(alarmInterval.current);
    if (!alarmsEnabled || !hasToday) return;
    const hasIn  = todayIn.length > 0;
    const hasOut = todayOut.length > 0;
    function fire() {
      if (!audioCtx.current)
        audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      playAlarmFor(audioCtx.current, hasIn, hasOut);
    }
    fire();
    alarmInterval.current = setInterval(fire, 5 * 60 * 1000);
    return () => clearInterval(alarmInterval.current);
  }, [alarmsEnabled, hasToday, todayIn.length, todayOut.length]);

  function triggerAlarm() {
    if (!audioCtx.current)
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
    playAlarmFor(audioCtx.current, todayIn.length > 0, todayOut.length > 0);
  }

  let displayed = [...data];
  if (search) {
    const q = search.toLowerCase();
    displayed = displayed.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
  }
  if (filter === 'today_in') displayed = displayed.filter(r => isToday(r._entrada));
  else if (filter === 'today_out') displayed = displayed.filter(r => isToday(r._salida));
  else if (filter === 'booking') displayed = displayed.filter(r => r._origen.includes('booking'));
  else if (filter === 'airbnb') displayed = displayed.filter(r => r._origen.includes('airbnb'));
  else if (filter === 'proximas') displayed = displayed.filter(r => { const x = daysDiff(r._entrada); return x !== null && x >= 0 && x <= 7; });

  displayed.sort((a, b) => {
    const da = sort === 'entrada' ? a._entrada : a._salida;
    const db = sort === 'entrada' ? b._entrada : b._salida;
    if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
    return da - db;
  });

  function savePhone(id) {
    setPhones(p => ({ ...p, [id]: phoneInput }));
    setEditingPhone(null); setPhoneInput('');
  }

  const CSS = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* FIX 3 — Variables sticky con valores por defecto sensatos en :root.
       Evitan el solapamiento en el primer frame antes de que ResizeObserver mida. */
    :root {
      --bg: #080b10; --s1: #0f1319; --s2: #161c26; --s3: #1e2635;
      --border: #252e42; --border2: #2e3a52;
      --accent: #f97316; --accent2: #38bdf8;
      --booking: #1a56db; --airbnb: #ff385c;
      --text: #e8edf5; --muted: #6b7a99;
      --green: #34d399; --yellow: #fbbf24; --red: #f87171; --purple: #a78bfa;
      --header-h: 56px;
      --header-tabs-h: 96px;
      --tbl-top: 310px;
    }
    body { background: var(--bg); color: var(--text); font-family: 'Syne', sans-serif; min-height: 100vh; }
    .mono { font-family: 'DM Mono', monospace; }

    .header {
      position: sticky; top: 0; z-index: 100;
      background: var(--s1); border-bottom: 1px solid var(--border);
      padding: 0.85rem 1.5rem;
      display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
    }
    .logo { font-size: 1.1rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem; }
    .logo-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
    .hdr-r { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; }
    .last-upd { font-family: 'DM Mono', monospace; font-size: 0.67rem; color: var(--muted); }

    /* FIX 3 — alarm-banner con valor por defecto explícito en top */
    .alarm-banner {
      position: sticky;
      top: var(--header-h, 56px);
      z-index: 99;
      background: rgba(248,113,113,0.07);
      border-bottom: 1px solid rgba(248,113,113,0.25);
      padding: 0.65rem 1.5rem;
      display: flex; align-items: center; gap: 0.75rem;
    }
    .bell { font-size: 1.2rem; animation: ring 0.55s ease-in-out infinite; display: inline-block; }
    @keyframes ring { 0%,100%{transform:rotate(-12deg)} 50%{transform:rotate(12deg)} }
    .alarm-title { font-weight: 700; font-size: 0.85rem; color: var(--red); }
    .alarm-detail { font-size: 0.7rem; color: #fca5a5; margin-top: 0.1rem; }

    /* FIX 3 — tabs con valor por defecto explícito en top */
    .tabs {
      position: sticky;
      top: var(--header-tabs-h, 96px);
      z-index: 98;
      display: flex; border-bottom: 1px solid var(--border); background: var(--s1); padding: 0 1.5rem;
    }
    .tab-btn {
      padding: 0.7rem 1.2rem; background: none; border: none; border-bottom: 2px solid transparent;
      cursor: pointer; font-family: 'Syne', sans-serif; font-size: 0.75rem; font-weight: 700;
      color: var(--muted); transition: all 0.15s; margin-bottom: -1px;
      text-transform: uppercase; letter-spacing: 0.06em;
    }
    .tab-btn:hover { color: var(--text); }
    .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }

    .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); gap: 0.7rem; padding: 1.2rem 1.5rem; }
    .stat { background: var(--s1); border: 1px solid var(--border); border-radius: 10px; padding: 0.85rem 1rem; }
    .stat-label { font-size: 0.63rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.35rem; }
    .stat-val { font-size: 1.75rem; font-weight: 800; line-height: 1.1; }
    .stat-sub { font-size: 0.65rem; color: var(--muted); margin-top: 0.2rem; font-family: 'DM Mono', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .controls { padding: 0 1.5rem 0.9rem; display: flex; gap: 0.45rem; flex-wrap: wrap; align-items: center; }
    .search {
      background: var(--s1); border: 1px solid var(--border); border-radius: 7px;
      padding: 0.45rem 0.85rem; color: var(--text);
      font-family: 'DM Mono', monospace; font-size: 0.78rem;
      width: 210px; outline: none; transition: border-color 0.2s;
    }
    .search:focus { border-color: var(--accent2); }
    .search::placeholder { color: var(--muted); }
    .fbtn {
      background: var(--s1); border: 1px solid var(--border); border-radius: 7px;
      padding: 0.4rem 0.8rem; color: var(--muted);
      cursor: pointer; font-family: 'Syne', sans-serif; font-size: 0.73rem; font-weight: 700;
      transition: all 0.15s; white-space: nowrap;
    }
    .fbtn:hover { color: var(--text); border-color: var(--border2); }
    .fbtn.on { color: #fff; }
    .fbtn.on.def { background: var(--accent); border-color: var(--accent); }
    .fbtn.on.bk { background: var(--booking); border-color: var(--booking); }
    .fbtn.on.ab { background: var(--airbnb); border-color: var(--airbnb); }
    .fbtn.on.gr { background: rgba(52,211,153,0.18); border-color: var(--green); color: var(--green); }
    .fbtn.on.yl { background: rgba(251,191,36,0.18); border-color: var(--yellow); color: var(--yellow); }
    .fbtn.on.pu { background: rgba(167,139,250,0.18); border-color: var(--purple); color: var(--purple); }
    .ml-auto { margin-left: auto; }
    .sep { width: 1px; height: 22px; background: var(--border); }

    /* Sticky thead — patrón correcto:
       .tbl-wrap: solo padding, sin overflow (overflow rompe sticky en hijos)
       .tbl-scroll: maneja AMBOS ejes de scroll → thead { top:0 } funciona dentro */
    .tbl-wrap { padding: 0 1.5rem 1rem; }
    .tbl-scroll {
      overflow: auto;
      max-height: calc(100vh - var(--tbl-top, 310px));
      min-height: 200px;
      border-radius: 8px;
      border: 1px solid var(--border);
    }

    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }

    thead th {
      background: var(--s1); border-bottom: 2px solid var(--border2);
      padding: 0.6rem 0.85rem; text-align: left;
      font-size: 0.63rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
      color: var(--muted); white-space: nowrap;
      position: sticky; top: 0; z-index: 10;
    }
    tbody tr { border-bottom: 1px solid var(--border); transition: background 0.1s; cursor: pointer; }
    tbody tr:hover { background: var(--s2); }
    tbody tr.in-today { border-left: 3px solid var(--green); }
    tbody tr.out-today { border-left: 3px solid var(--yellow); }
    tbody tr.is-called td:not(.ac) { opacity: 0.4; }
    td { padding: 0.68rem 0.85rem; vertical-align: middle; }

    /* Clases helper para truncado de texto en celdas largas.
       CSS en <td> no trunca en tablas; el <div> interno sí lo hace. */
    .cell-truncate {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cell-aloj  { max-width: 160px; font-weight: 700; }
    .cell-nombre{ max-width: 160px; font-size: 0.65rem; color: var(--muted); margin-top: 0.15rem; font-style: italic; }
    .cell-obs   { max-width: 160px; color: var(--muted); font-size: 0.71rem; }
    .cell-kiko  { max-width: 140px; color: var(--muted); font-size: 0.71rem; }

    /* Teléfono del sheet (solo lectura, diferenciado del manual) */
    .phone-sheet { font-family: 'DM Mono', monospace; font-size: 0.78rem; color: var(--accent2); }

    .bdg {
      display: inline-flex; align-items: center; gap: 0.3rem;
      padding: 0.16rem 0.5rem; border-radius: 5px;
      font-size: 0.63rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
    }
    .bdg-bk { background: rgba(26,86,219,0.18); color: #93c5fd; border: 1px solid rgba(26,86,219,0.35); }
    .bdg-ab { background: rgba(255,56,92,0.15); color: #fca5a5; border: 1px solid rgba(255,56,92,0.28); }

    .tag {
      display: inline-block; padding: 0.1rem 0.42rem; border-radius: 4px;
      font-size: 0.58rem; font-weight: 700; text-transform: uppercase; margin-left: 0.3rem; vertical-align: middle;
    }
    .tag-in { background: rgba(52,211,153,0.13); color: var(--green); border: 1px solid rgba(52,211,153,0.22); }
    .tag-out { background: rgba(251,191,36,0.13); color: var(--yellow); border: 1px solid rgba(251,191,36,0.22); }
    .days-lbl { font-family: 'DM Mono', monospace; font-size: 0.65rem; color: var(--muted); margin-left: 0.3rem; }

    .phone-cell { display: flex; align-items: center; gap: 0.35rem; }
    .phone-val { font-family: 'DM Mono', monospace; font-size: 0.78rem; }
    .phone-empty { color: var(--muted); font-size: 0.7rem; font-style: italic; }
    .phone-input {
      background: var(--bg); border: 1px solid var(--accent2); border-radius: 5px;
      padding: 0.2rem 0.45rem; color: var(--text);
      font-family: 'DM Mono', monospace; font-size: 0.78rem; width: 135px; outline: none;
    }

    .btn {
      padding: 0.28rem 0.65rem; border-radius: 6px; border: none;
      cursor: pointer; font-family: 'Syne', sans-serif; font-size: 0.7rem; font-weight: 700;
      transition: all 0.15s; white-space: nowrap;
    }
    .btn-accent { background: var(--accent); color: #fff; }
    .btn-accent:hover { background: #ea6b10; }
    .btn-ghost { background: var(--s2); color: var(--text); border: 1px solid var(--border); }
    .btn-ghost:hover { border-color: var(--border2); }
    .btn-call { background: rgba(56,189,248,0.1); color: var(--accent2); border: 1px solid rgba(56,189,248,0.22); }
    .btn-called { background: rgba(52,211,153,0.1); color: var(--green); border: 1px solid rgba(52,211,153,0.22); }
    .btn-red { background: var(--red); color: #fff; }
    .btn-xs { padding: 0.16rem 0.42rem; font-size: 0.63rem; }

    .tog-wrap { display: flex; align-items: center; gap: 0.4rem; }
    .tog-lbl { font-size: 0.7rem; color: var(--muted); }
    .tog { position: relative; width: 32px; height: 17px; cursor: pointer; }
    .tog input { opacity: 0; width: 0; height: 0; }
    .tog-sl { position: absolute; inset: 0; background: var(--border2); border-radius: 17px; transition: 0.2s; }
    .tog-sl::before { content:''; position: absolute; width:11px; height:11px; left:3px; bottom:3px; background:#fff; border-radius:50%; transition:0.2s; }
    input:checked + .tog-sl { background: var(--green); }
    input:checked + .tog-sl::before { transform: translateX(15px); }

    .exp-td { background: var(--s2) !important; padding: 0.5rem 0.85rem 1rem 2rem !important; }
    .exp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 0.55rem 1rem; }
    .exp-item label { font-size: 0.6rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; display: block; margin-bottom: 0.1rem; }
    .exp-item span { font-size: 0.77rem; font-family: 'DM Mono', monospace; }

    /* fin-table — mismo patrón sticky dentro de .tbl-scroll */
    .fin-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
    .fin-table th {
      background: var(--s1); border-bottom: 2px solid var(--border2);
      padding: 0.58rem 0.85rem; text-align: left;
      font-size: 0.63rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
      color: var(--muted); white-space: nowrap;
      position: sticky; top: 0; z-index: 10;
    }
    .fin-table td { padding: 0.62rem 0.85rem; border-bottom: 1px solid var(--border); }
    .fin-table tr:hover td { background: var(--s2); }
    .money { font-family: 'DM Mono', monospace; text-align: right; color: var(--green); }
    .total-row td { background: var(--s2); font-weight: 700; }

    .center { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 2rem; gap: 1rem; }
    .spinner { width: 34px; height: 34px; border: 2px solid var(--border2); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.65s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-icon { font-size: 2.5rem; }
    .empty-txt { color: var(--muted); font-size: 0.83rem; }
    .footer-bar { padding: 0.7rem 1.5rem; color: var(--muted); font-size: 0.67rem; font-family: 'DM Mono', monospace; border-top: 1px solid var(--border); }

    @media(max-width:700px){
      .header,.tabs,.stats,.controls,.tbl-wrap{padding-left:1rem;padding-right:1rem;}
      .stats{grid-template-columns:repeat(auto-fill,minmax(130px,1fr));}
      .search{width:100%;}
    }
  `;

  return (
    <>
      <Head>
        <title>Dashboard Reservas · Booking & Airbnb</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
        <style>{CSS}</style>
      </Head>

      {/* Header */}
      <header className="header" ref={headerRef}>
        <div className="logo">
          <div className="logo-dot" />
          Reservas Dashboard
        </div>
        <div className="hdr-r">
          {lastUpdate && <span className="last-upd mono">↻ {lastUpdate.toLocaleTimeString('es-ES')}</span>}
          <div className="tog-wrap">
            <span className="tog-lbl">🔔 Alarmas</span>
            <label className="tog">
              <input type="checkbox" checked={alarmsEnabled} onChange={e => setAlarmsEnabled(e.target.checked)} />
              <span className="tog-sl" />
            </label>
          </div>
          {hasToday && <button className="btn btn-red" onClick={triggerAlarm}>🔔 Sonar</button>}
          <button className="btn btn-ghost" onClick={() => { setLoading(true); fetchData(); }}>↻ Actualizar</button>
        </div>
      </header>

      {/* Alarm banner */}
      {hasToday && alarmsEnabled && (
        <div className="alarm-banner" ref={bannerRef}>
          <span className="bell">🔔</span>
          <div>
            <div className="alarm-title">
              {todayIn.length > 0 && `${todayIn.length} ENTRADA${todayIn.length > 1 ? 'S' : ''} HOY`}
              {todayIn.length > 0 && todayOut.length > 0 && ' · '}
              {todayOut.length > 0 && `${todayOut.length} SALIDA${todayOut.length > 1 ? 'S' : ''} HOY`}
            </div>
            <div className="alarm-detail">
              {/* FIX 4 — safeGet para no romper si keys.alojamiento es undefined */}
              {[...todayIn, ...todayOut].map(r => safeGet(r, keys.alojamiento)).filter(v => v !== '—').join(' · ') || 'Contacta al cliente'}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" ref={tabsRef}>
        {[['reservas', '📅 Reservas'], ['financiero', '💶 Financiero']].map(([k, l]) => (
          <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {/* Stats */}
      <div className="stats" ref={statsRef}>
        <div className="stat">
          <div className="stat-label">Total reservas</div>
          <div className="stat-val" style={{ color: 'var(--accent)' }}>{data.length}</div>
          <div className="stat-sub">Booking + Airbnb</div>
        </div>
        <div className="stat">
          <div className="stat-label">Entradas hoy</div>
          <div className="stat-val" style={{ color: 'var(--green)' }}>{todayIn.length}</div>
          <div className="stat-sub">{todayIn.map(r => safeGet(r, keys.alojamiento)).filter(v => v !== '—').join(', ') || 'Ninguna'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Salidas hoy</div>
          <div className="stat-val" style={{ color: 'var(--yellow)' }}>{todayOut.length}</div>
          <div className="stat-sub">{todayOut.map(r => safeGet(r, keys.alojamiento)).filter(v => v !== '—').join(', ') || 'Ninguna'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Booking</div>
          <div className="stat-val" style={{ color: '#93c5fd' }}>{data.filter(r => r._origen.includes('booking')).length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Airbnb</div>
          <div className="stat-val" style={{ color: '#fca5a5' }}>{data.filter(r => r._origen.includes('airbnb')).length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Ya llamados</div>
          <div className="stat-val" style={{ color: 'var(--green)' }}>{Object.values(called).filter(Boolean).length}</div>
          <div className="stat-sub">de {data.length} reservas</div>
        </div>
      </div>

      {/* Controls */}
      <div className="controls" ref={controlsRef}>
        <input className="search" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        {[
          { key: 'all', label: 'Todas', cls: 'def' },
          { key: 'today_in', label: '📥 Entran hoy', cls: 'gr' },
          { key: 'today_out', label: '📤 Salen hoy', cls: 'yl' },
          { key: 'proximas', label: '📆 Próx. 7 días', cls: 'pu' },
          { key: 'booking', label: '✈ Booking', cls: 'bk' },
          { key: 'airbnb', label: '🏠 Airbnb', cls: 'ab' },
        ].map(f => (
          <button key={f.key} className={`fbtn ${filter === f.key ? `on ${f.cls}` : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
        <div className="sep ml-auto" />
        <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Orden:</span>
        {[['entrada', 'Entrada ↑'], ['salida', 'Salida ↑']].map(([k, l]) => (
          <button key={k} className={`fbtn ${sort === k ? 'on def' : ''}`} onClick={() => setSort(k)}>{l}</button>
        ))}
      </div>

      {/* Debug bar — muestra qué columnas detectó la API del Sheet.
          Si NOMBRE o TELEFONO no aparecen aquí, el tab o la URL del Sheet es incorrecto. */}
      {detectedCols.length > 0 && (
        <div style={{ padding: '0 1.5rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowDebug(v => !v)}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '0.15rem 0.5rem', color: 'var(--muted)', fontSize: '0.6rem', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}
          >
            {showDebug ? '▲' : '▼'} cols Sheet ({detectedCols.length})
          </button>
          {showDebug && detectedCols.map(c => (
            <span key={c} style={{
              fontSize: '0.58rem', fontFamily: 'DM Mono, monospace', padding: '0.1rem 0.35rem',
              borderRadius: 4, background: 'var(--s2)', border: '1px solid var(--border)',
              color: ['NOMBRE','TELEFONO','TELÉFONO'].includes(c.toUpperCase().trim()) ? 'var(--green)' : 'var(--muted)'
            }}>{c}</span>
          ))}
        </div>
      )}
        <div className="center"><div className="spinner" /><span className="empty-txt">Cargando datos del Google Sheet…</span></div>
      ) : error ? (
        <div className="center">
          <div className="empty-icon">⚠️</div>
          <div className="empty-txt">Error: {error}</div>
          <button className="btn btn-accent" onClick={fetchData}>Reintentar</button>
        </div>
      ) : tab === 'reservas' ? (
        <>
          <div className="tbl-wrap">
            {displayed.length === 0 ? (
              <div className="center"><div className="empty-icon">🏖️</div><div className="empty-txt">Sin reservas con ese filtro.</div></div>
            ) : (
              <div className="tbl-scroll">
              <table>
                  {/* FIX 1 — thead con exactamente 9 columnas, numeradas para auditoría */}
                  <thead>
                    <tr>
                      <th>Alojamiento</th>                        {/* 1 */}
                      <th>Origen</th>                             {/* 2 */}
                      <th>Entrada</th>                            {/* 3 */}
                      <th>Salida</th>                             {/* 4 */}
                      <th style={{ textAlign: 'center' }}>Noches</th> {/* 5 */}
                      <th>Teléfono</th>                           {/* 6 */}
                      <th>Acción</th>                             {/* 7 */}
                      <th>Observaciones</th>                      {/* 8 */}
                      <th>Datos Kiko</th>                         {/* 9 */}
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.flatMap(row => {
                      const id = row._id;
                      const isExp = expandedRow === id;
                      const eHoy = isToday(row._entrada);
                      const sHoy = isToday(row._salida);
                      const dIn = daysDiff(row._entrada);
                      const dOut = daysDiff(row._salida);
                      const isCalled = called[id];
                      const phone = phones[id] || '';
                      let nights = '—';
                      if (row._entrada && row._salida)
                        nights = Math.round((row._salida - row._entrada) / 86400000);

                      return [
                        <tr
                          key={`r${id}`}
                          className={`${eHoy ? 'in-today' : sHoy ? 'out-today' : ''} ${isCalled ? 'is-called' : ''}`}
                          onClick={() => setExpandedRow(isExp ? null : id)}
                        >
                          {/* TD 1: Alojamiento + NOMBRE como subtítulo */}
                          <td>
                            <div className="cell-truncate cell-aloj">
                              {safeGet(row, keys.alojamiento)}
                            </div>
                            {safeGet(row, keys.nombre) !== '—' && (
                              <div className="cell-truncate cell-nombre">
                                {safeGet(row, keys.nombre)}
                              </div>
                            )}
                          </td>

                          {/* FIX 4 — TD 2: Origen con safeGet */}
                          <td>
                            <span className={`bdg ${row._origen.includes('booking') ? 'bdg-bk' : 'bdg-ab'}`}>
                              {row._origen.includes('booking') ? '✈' : '🏠'} {safeGet(row, keys.origen)}
                            </span>
                          </td>

                          {/* TD 3: Entrada */}
                          <td>
                            <span className="mono">{formatDate(row._entrada)}</span>
                            {eHoy && <span className="tag tag-in">HOY ✈</span>}
                            {!eHoy && dIn !== null && dIn > 0 && dIn <= 30 && <span className="days-lbl">+{dIn}d</span>}
                          </td>

                          {/* TD 4: Salida */}
                          <td>
                            <span className="mono">{formatDate(row._salida)}</span>
                            {sHoy && <span className="tag tag-out">HOY 🚪</span>}
                            {!sHoy && dOut !== null && dOut > 0 && dOut <= 30 && <span className="days-lbl">+{dOut}d</span>}
                          </td>

                          {/* TD 5: Noches */}
                          <td className="mono" style={{ textAlign: 'center', color: 'var(--muted)' }}>{nights}</td>

                          {/* TD 6: Teléfono — sheet primero, manual como override */}
                          <td className="ac" onClick={e => e.stopPropagation()}>
                            <div className="phone-cell">
                              {editingPhone === id ? (
                                <>
                                  <input
                                    className="phone-input"
                                    value={phoneInput}
                                    placeholder="+34 600 000 000"
                                    onChange={e => setPhoneInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') savePhone(id); if (e.key === 'Escape') setEditingPhone(null); }}
                                    autoFocus
                                  />
                                  <button className="btn btn-accent btn-xs" onClick={() => savePhone(id)}>✓</button>
                                  <button className="btn btn-ghost btn-xs" onClick={() => setEditingPhone(null)}>✕</button>
                                </>
                              ) : (() => {
                                const sheetPhone = safeGet(row, keys.telefono) !== '—' ? safeGet(row, keys.telefono) : '';
                                const displayPhone = phone || sheetPhone;
                                return (
                                  <>
                                    {displayPhone
                                      ? <span className={phone ? 'phone-val' : 'phone-sheet'}>{displayPhone}</span>
                                      : <span className="phone-empty">Sin tel.</span>
                                    }
                                    <button
                                      className="btn btn-ghost btn-xs"
                                      onClick={() => { setEditingPhone(id); setPhoneInput(phone || sheetPhone); }}
                                    >✏️</button>
                                  </>
                                );
                              })()}
                            </div>
                          </td>

                          {/* TD 7: Acción */}
                          <td className="ac" onClick={e => e.stopPropagation()}>
                            <button
                              className={`btn btn-xs ${isCalled ? 'btn-called' : 'btn-call'}`}
                              onClick={() => setCalled(p => ({ ...p, [id]: !p[id] }))}
                            >
                              {isCalled ? '✅ Llamado' : '📞 Llamar'}
                            </button>
                          </td>

                          {/* FIX 1+2+4 — TD 8: Observaciones con div truncador y safeGet */}
                          <td>
                            <div className="cell-truncate cell-obs">
                              {safeGet(row, keys.observaciones)}
                            </div>
                          </td>

                          {/* FIX 1+2+4 — TD 9: Datos Kiko con div truncador y safeGet */}
                          <td>
                            <div className="cell-truncate cell-kiko">
                              {safeGet(row, keys.datosKiko)}
                            </div>
                          </td>
                        </tr>,

                        isExp && (
                          <tr key={`e${id}`}>
                            <td colSpan={9} className="exp-td">
                              <div className="exp-grid">
                                {Object.entries(row)
                                  .filter(([k]) => !k.startsWith('_'))
                                  .filter(([, v]) => v)
                                  .map(([k, v]) => (
                                    <div className="exp-item" key={k}>
                                      <label>{k}</label>
                                      <span>{v}</span>
                                    </div>
                                  ))}
                                {phones[id] && (
                                  <div className="exp-item">
                                    <label>Teléfono (manual)</label>
                                    <span>{phones[id]}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="footer-bar">
            {displayed.length} reservas · {data.length} total Booking + Airbnb · Haz clic en una fila para ver todos los datos
          </div>
        </>
      ) : (
        /* Financiero */
        <div className="tbl-wrap">
          <div className="tbl-scroll">
          <table className="fin-table">
              {/* FIX 1 — 12 columnas exactas, comentadas para auditoría futura */}
              <thead>
                <tr>
                  <th>Alojamiento</th>        {/* 1  */}
                  <th>Origen</th>             {/* 2  */}
                  <th>Entrada</th>            {/* 3  */}
                  <th>Salida</th>             {/* 4  */}
                  <th>Cobrado A</th>          {/* 5  */}
                  <th>Cobrado B</th>          {/* 6  */}
                  <th>Total Cobrado</th>      {/* 7  */}
                  <th>Ingreso Canal Neto</th> {/* 8  */}
                  <th>Fecha Pago</th>         {/* 9  */}
                  <th>2º Ingreso Neto</th>    {/* 10 */}
                  <th>Fecha Pago 2</th>       {/* 11 */}
                  <th>Reportes</th>           {/* 12 */}
                </tr>
              </thead>
              <tbody>
                {/* FIX 4 — todas las celdas usan safeGet; formatMoney usa la v5 robusta */}
                {displayed.map(row => (
                  <tr key={row._id}>
                    <td style={{ fontWeight: 600 }}>{safeGet(row, keys.alojamiento)}</td>            {/* 1  */}
                    <td>
                      <span className={`bdg ${row._origen.includes('booking') ? 'bdg-bk' : 'bdg-ab'}`}>
                        {safeGet(row, keys.origen)}
                      </span>
                    </td>                                                                              {/* 2  */}
                    <td className="mono" style={{ fontSize: '0.73rem' }}>{formatDate(row._entrada)}</td> {/* 3  */}
                    <td className="mono" style={{ fontSize: '0.73rem' }}>{formatDate(row._salida)}</td>  {/* 4  */}
                    <td className="money">{formatMoney(row[keys.cobradoA])}</td>                      {/* 5  */}
                    <td className="money">{formatMoney(row[keys.cobradoB])}</td>                      {/* 6  */}
                    <td className="money" style={{ fontWeight: 700 }}>{formatMoney(row[keys.totalCobrado])}</td> {/* 7  */}
                    <td className="money">{formatMoney(row[keys.ingresoCanal])}</td>                  {/* 8  */}
                    <td className="mono" style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{safeGet(row, keys.fechaPago)}</td>   {/* 9  */}
                    <td className="money">{formatMoney(row[keys.segundoIngreso])}</td>               {/* 10 */}
                    <td className="mono" style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{safeGet(row, keys.fechaPago2)}</td>  {/* 11 */}
                    <td style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{safeGet(row, keys.reportes)}</td> {/* 12 */}
                  </tr>
                ))}

                {/* FIX 1 — Fila TOTALES: colSpan auditado → 4 + 1 + 1 + 1 + 1 + 4 = 12 ✓
                    FIX 5 — Acumuladores usando formatMoney robusto con detección europea */}
                <tr className="total-row">
                  <td colSpan={4} style={{ textAlign: 'right', color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    TOTALES — {displayed.length} reservas
                  </td>                                                                {/* cols 1-4 */}
                  <td className="money" style={{ color: 'var(--muted)' }}>—</td>      {/* col 5  */}
                  <td className="money" style={{ color: 'var(--muted)' }}>—</td>      {/* col 6  */}
                  <td className="money" style={{ color: 'var(--accent)', fontWeight: 800 }}>
                    {formatMoney(
                      displayed.reduce((s, r) => {
                        const raw = String(r[keys.totalCobrado] || '').replace(/[€$£\s]/g, '').replace(/\./g, '').replace(',', '.');
                        return s + (parseFloat(raw) || 0);
                      }, 0)
                    )}
                  </td>                                                                {/* col 7  */}
                  <td className="money" style={{ color: 'var(--green)', fontWeight: 800 }}>
                    {formatMoney(
                      displayed.reduce((s, r) => {
                        const raw = String(r[keys.ingresoCanal] || '').replace(/[€$£\s]/g, '').replace(/\./g, '').replace(',', '.');
                        return s + (parseFloat(raw) || 0);
                      }, 0)
                    )}
                  </td>                                                                {/* col 8  */}
                  <td colSpan={4} />                                                   {/* cols 9-12 */}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="footer-bar">
            {displayed.length} reservas · Columnas: COBRADO A, COBRADO B, TOTAL COBRADO, INGRESO CANAL NETO, DATOS KIKO
          </div>
        </div>
      )}
    </>
  );
}
