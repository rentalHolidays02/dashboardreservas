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
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
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

function formatMoney(val) {
  if (val === null || val === undefined || val === '') return '—';
  const str = String(val).trim();
  if (!str || str === '—') return '—';
  const cleaned = str.replace(/[€$£\s]/g, '').trim();
  if (!cleaned) return '—';
  let num;
  if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    num = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  } else if (/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(cleaned)) {
    num = parseFloat(cleaned.replace(/,/g, ''));
  } else {
    num = parseFloat(cleaned.replace(/,/g, '.'));
  }
  if (isNaN(num)) return str || '—';
  return num.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

function safeGet(row, key) {
  if (!key) return '—';
  const val = row[key];
  return (val !== undefined && val !== null && String(val).trim() !== '') ? String(val).trim() : '—';
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

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch('/api/reservas');
      const json = await r.json();
      if (json.error && !json.data) throw new Error(json.error);
      const safeKeys = Object.fromEntries(
        Object.entries(json.keys || {}).map(([k, v]) => [k, v ? String(v) : ''])
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

  // Solo necesario para las variables CSS del banner y tabs sticky
  useEffect(() => {
    function measure() {
      const hH = headerRef.current?.offsetHeight || 0;
      const bH = bannerRef.current?.offsetHeight || 0;
      if (!hH) return;
      document.documentElement.style.setProperty('--header-h', `${hH}px`);
      document.documentElement.style.setProperty('--header-tabs-h', `${hH + bH}px`);
    }
    requestAnimationFrame(measure);
    const obs = new ResizeObserver(measure);
    [headerRef, bannerRef, tabsRef].forEach(r => r.current && obs.observe(r.current));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    clearInterval(alarmInterval.current);
    if (!alarmsEnabled || !hasToday) return;
    const hasIn = todayIn.length > 0, hasOut = todayOut.length > 0;
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

    /* ── Layout raíz: flex column de 100vh ───────────────────────────────────
       Este es el secreto del sticky thead funcional.
       #__next es un flex-column que ocupa exactamente la pantalla.
       .tbl-area toma el espacio restante y scrollea internamente.
       thead { top:0 } funciona porque .tbl-area es su scroll container. ── */
    html, body { height: 100%; }
    #__next { height: 100%; display: flex; flex-direction: column; }

    :root {
      --bg: #080b10; --s1: #0f1319; --s2: #161c26;
      --border: #252e42; --border2: #2e3a52;
      --accent: #f97316; --accent2: #38bdf8;
      --booking: #1a56db; --airbnb: #ff385c;
      --text: #e8edf5; --muted: #6b7a99;
      --green: #34d399; --yellow: #fbbf24; --red: #f87171; --purple: #a78bfa;
      --header-h: 56px; --header-tabs-h: 94px;
    }
    body { background: var(--bg); color: var(--text); font-family: 'Syne', sans-serif; }
    .mono { font-family: 'DM Mono', monospace; }

    /* ── Elementos sticky de página (header, banner, tabs) ── */
    .header {
      flex-shrink: 0;
      position: sticky; top: 0; z-index: 100;
      background: var(--s1); border-bottom: 1px solid var(--border);
      padding: 0.85rem 1.5rem;
      display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
    }
    .logo { font-size: 1.1rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem; }
    .logo-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
    .hdr-r { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; }
    .last-upd { font-family: 'DM Mono', monospace; font-size: 0.67rem; color: var(--muted); }

    .alarm-banner {
      flex-shrink: 0;
      position: sticky; top: var(--header-h, 56px); z-index: 99;
      background: rgba(248,113,113,0.07); border-bottom: 1px solid rgba(248,113,113,0.25);
      padding: 0.65rem 1.5rem; display: flex; align-items: center; gap: 0.75rem;
    }
    .bell { font-size: 1.2rem; animation: ring 0.55s ease-in-out infinite; display: inline-block; }
    @keyframes ring { 0%,100%{transform:rotate(-12deg)} 50%{transform:rotate(12deg)} }
    .alarm-title { font-weight: 700; font-size: 0.85rem; color: var(--red); }
    .alarm-detail { font-size: 0.7rem; margin-top: 0.1rem; }

    .tabs {
      flex-shrink: 0;
      position: sticky; top: var(--header-tabs-h, 94px); z-index: 98;
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

    /* ── Stats y controls: flex-shrink:0, no scrollean, siempre visibles ── */
    .stats {
      flex-shrink: 0;
      display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 0.6rem; padding: 0.9rem 1.5rem;
    }
    .stat { background: var(--s1); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem 1rem; }
    .stat-label { font-size: 0.6rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.3rem; }
    .stat-val { font-size: 1.6rem; font-weight: 800; line-height: 1.1; }
    .stat-sub { font-size: 0.62rem; color: var(--muted); margin-top: 0.15rem; font-family: 'DM Mono', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .controls {
      flex-shrink: 0;
      padding: 0 1.5rem 0.75rem; display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;
    }
    .debug-bar { flex-shrink: 0; padding: 0 1.5rem 0.4rem; display: flex; gap: 0.35rem; flex-wrap: wrap; align-items: center; }

    .search {
      background: var(--s1); border: 1px solid var(--border); border-radius: 7px;
      padding: 0.42rem 0.85rem; color: var(--text);
      font-family: 'DM Mono', monospace; font-size: 0.78rem;
      width: 200px; outline: none; transition: border-color 0.2s;
    }
    .search:focus { border-color: var(--accent2); }
    .search::placeholder { color: var(--muted); }
    .fbtn {
      background: var(--s1); border: 1px solid var(--border); border-radius: 7px;
      padding: 0.38rem 0.75rem; color: var(--muted);
      cursor: pointer; font-family: 'Syne', sans-serif; font-size: 0.72rem; font-weight: 700;
      transition: all 0.15s; white-space: nowrap;
    }
    .fbtn:hover { color: var(--text); border-color: var(--border2); }
    .fbtn.on { color: #fff; }
    .fbtn.on.def { background: var(--accent); border-color: var(--accent); }
    .fbtn.on.bk  { background: var(--booking); border-color: var(--booking); }
    .fbtn.on.ab  { background: var(--airbnb); border-color: var(--airbnb); }
    .fbtn.on.gr  { background: rgba(52,211,153,0.18); border-color: var(--green); color: var(--green); }
    .fbtn.on.yl  { background: rgba(251,191,36,0.18); border-color: var(--yellow); color: var(--yellow); }
    .fbtn.on.pu  { background: rgba(167,139,250,0.18); border-color: var(--purple); color: var(--purple); }
    .ml-auto { margin-left: auto; }
    .sep { width: 1px; height: 20px; background: var(--border); }

    /* ── ÁREA DE LA TABLA ─────────────────────────────────────────────────────
       flex:1 + overflow:auto → ocupa todo el espacio restante y scrollea.
       SIN overflow-x separado → thead sticky funciona perfectamente.        ── */
    .tbl-area {
      flex: 1;
      overflow: auto;
      min-height: 0;
    }

    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; min-width: 820px; }

    /* ── FILA DE CABECERA FIJA ── top:0 dentro de .tbl-area ── */
    thead th {
      position: sticky;
      top: 0;
      z-index: 10;
      background: var(--s1);
      border-bottom: 2px solid var(--border2);
      padding: 0.6rem 0.85rem; text-align: left;
      font-size: 0.63rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
      color: var(--muted); white-space: nowrap;
    }

    tbody tr { border-bottom: 1px solid var(--border); transition: background 0.1s; cursor: pointer; }
    tbody tr:hover { background: var(--s2); }
    tbody tr.in-today { border-left: 3px solid var(--green); }
    tbody tr.out-today { border-left: 3px solid var(--yellow); }
    tbody tr.is-called td:not(.ac) { opacity: 0.4; }
    td { padding: 0.65rem 0.85rem; vertical-align: middle; }

    .cell-truncate { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cell-aloj   { max-width: 155px; font-weight: 700; }
    .cell-nombre { max-width: 155px; font-size: 0.64rem; color: var(--muted); margin-top: 0.12rem; font-style: italic; }
    .cell-obs    { max-width: 155px; color: var(--muted); font-size: 0.7rem; }
    .cell-kiko   { max-width: 135px; color: var(--muted); font-size: 0.7rem; }

    .bdg {
      display: inline-flex; align-items: center; gap: 0.3rem;
      padding: 0.15rem 0.48rem; border-radius: 5px;
      font-size: 0.62rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
    }
    .bdg-bk { background: rgba(26,86,219,0.18); color: #93c5fd; border: 1px solid rgba(26,86,219,0.35); }
    .bdg-ab { background: rgba(255,56,92,0.15); color: #fca5a5; border: 1px solid rgba(255,56,92,0.28); }

    .tag { display: inline-block; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.57rem; font-weight: 700; text-transform: uppercase; margin-left: 0.3rem; vertical-align: middle; }
    .tag-in  { background: rgba(52,211,153,0.13); color: var(--green); border: 1px solid rgba(52,211,153,0.22); }
    .tag-out { background: rgba(251,191,36,0.13); color: var(--yellow); border: 1px solid rgba(251,191,36,0.22); }
    .days-lbl { font-family: 'DM Mono', monospace; font-size: 0.63rem; color: var(--muted); margin-left: 0.3rem; }

    .phone-cell { display: flex; align-items: center; gap: 0.32rem; }
    .phone-val   { font-family: 'DM Mono', monospace; font-size: 0.78rem; }
    .phone-sheet { font-family: 'DM Mono', monospace; font-size: 0.78rem; color: var(--accent2); }
    .phone-empty { color: var(--muted); font-size: 0.7rem; font-style: italic; }
    .phone-input {
      background: var(--bg); border: 1px solid var(--accent2); border-radius: 5px;
      padding: 0.2rem 0.42rem; color: var(--text);
      font-family: 'DM Mono', monospace; font-size: 0.78rem; width: 130px; outline: none;
    }

    .btn {
      padding: 0.26rem 0.62rem; border-radius: 6px; border: none;
      cursor: pointer; font-family: 'Syne', sans-serif; font-size: 0.7rem; font-weight: 700;
      transition: all 0.15s; white-space: nowrap;
    }
    .btn-accent  { background: var(--accent); color: #fff; }
    .btn-accent:hover { background: #ea6b10; }
    .btn-ghost   { background: var(--s2); color: var(--text); border: 1px solid var(--border); }
    .btn-ghost:hover { border-color: var(--border2); }
    .btn-call    { background: rgba(56,189,248,0.1); color: var(--accent2); border: 1px solid rgba(56,189,248,0.22); }
    .btn-called  { background: rgba(52,211,153,0.1); color: var(--green); border: 1px solid rgba(52,211,153,0.22); }
    .btn-red     { background: var(--red); color: #fff; }
    .btn-xs      { padding: 0.14rem 0.4rem; font-size: 0.62rem; }

    .tog-wrap { display: flex; align-items: center; gap: 0.4rem; }
    .tog-lbl  { font-size: 0.7rem; color: var(--muted); }
    .tog      { position: relative; width: 32px; height: 17px; cursor: pointer; }
    .tog input { opacity: 0; width: 0; height: 0; }
    .tog-sl   { position: absolute; inset: 0; background: var(--border2); border-radius: 17px; transition: 0.2s; }
    .tog-sl::before { content:''; position: absolute; width:11px; height:11px; left:3px; bottom:3px; background:#fff; border-radius:50%; transition:0.2s; }
    input:checked + .tog-sl { background: var(--green); }
    input:checked + .tog-sl::before { transform: translateX(15px); }

    .exp-td { background: var(--s2) !important; padding: 0.5rem 0.85rem 1rem 2rem !important; }
    .exp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 0.5rem 1rem; }
    .exp-item label { font-size: 0.6rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; display: block; margin-bottom: 0.1rem; }
    .exp-item span  { font-size: 0.77rem; font-family: 'DM Mono', monospace; }

    .fin-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; min-width: 1000px; }
    .fin-table th {
      position: sticky; top: 0; z-index: 10;
      background: var(--s1); border-bottom: 2px solid var(--border2);
      padding: 0.56rem 0.85rem; text-align: left;
      font-size: 0.63rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
      color: var(--muted); white-space: nowrap;
    }
    .fin-table td { padding: 0.6rem 0.85rem; border-bottom: 1px solid var(--border); }
    .fin-table tr:hover td { background: var(--s2); }
    .money { font-family: 'DM Mono', monospace; text-align: right; color: var(--green); }
    .total-row td { background: var(--s2); font-weight: 700; }

    .tbl-padding { padding: 0 1.5rem 2rem; }
    .center { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; gap: 1rem; }
    .spinner { width: 34px; height: 34px; border: 2px solid var(--border2); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.65s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-icon { font-size: 2.5rem; }
    .empty-txt  { color: var(--muted); font-size: 0.83rem; }
    .footer-bar { padding: 0.65rem 1.5rem; color: var(--muted); font-size: 0.67rem; font-family: 'DM Mono', monospace; border-top: 1px solid var(--border); flex-shrink: 0; }

    @media(max-width:700px){
      .header,.tabs,.stats,.controls,.tbl-area{padding-left:1rem;padding-right:1rem;}
      .stats{grid-template-columns:repeat(auto-fill,minmax(125px,1fr));}
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
          <div style={{ flex: 1 }}>
            <div className="alarm-title">
              {todayIn.length > 0 && `✈ ${todayIn.length} ENTRADA${todayIn.length > 1 ? 'S' : ''} HOY`}
              {todayIn.length > 0 && todayOut.length > 0 && <span style={{ color: 'var(--muted)', margin: '0 0.4rem' }}>·</span>}
              {todayOut.length > 0 && `🚪 ${todayOut.length} SALIDA${todayOut.length > 1 ? 'S' : ''} HOY`}
            </div>
            <div className="alarm-detail">
              {todayIn.length > 0 && <span style={{ color: 'var(--green)' }}>✈ {todayIn.map(r => safeGet(r, keys.alojamiento)).filter(v => v !== '—').join(', ') || '—'}</span>}
              {todayIn.length > 0 && todayOut.length > 0 && <span style={{ margin: '0 0.4rem', color: 'var(--muted)' }}>·</span>}
              {todayOut.length > 0 && <span style={{ color: 'var(--yellow)' }}>🚪 {todayOut.map(r => safeGet(r, keys.alojamiento)).filter(v => v !== '—').join(', ') || '—'}</span>}
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
      <div className="stats">
        <div className="stat">
          <div className="stat-label">Total</div>
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
          <div className="stat-label">Llamados</div>
          <div className="stat-val" style={{ color: 'var(--green)' }}>{Object.values(called).filter(Boolean).length}</div>
          <div className="stat-sub">de {data.length}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        <input className="search" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        {[
          { key: 'all',       label: 'Todas',          cls: 'def' },
          { key: 'today_in',  label: '📥 Entran hoy',  cls: 'gr'  },
          { key: 'today_out', label: '📤 Salen hoy',   cls: 'yl'  },
          { key: 'proximas',  label: '📆 Próx. 7 días', cls: 'pu' },
          { key: 'booking',   label: '✈ Booking',      cls: 'bk'  },
          { key: 'airbnb',    label: '🏠 Airbnb',      cls: 'ab'  },
        ].map(f => (
          <button key={f.key} className={`fbtn ${filter === f.key ? `on ${f.cls}` : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
        <div className="sep ml-auto" />
        <span style={{ fontSize: '0.67rem', color: 'var(--muted)' }}>Orden:</span>
        {[['entrada', 'Entrada ↑'], ['salida', 'Salida ↑']].map(([k, l]) => (
          <button key={k} className={`fbtn ${sort === k ? 'on def' : ''}`} onClick={() => setSort(k)}>{l}</button>
        ))}
      </div>

      {/* Debug bar — abre/cierra para ver qué columnas lee la API */}
      {detectedCols.length > 0 && (
        <div className="debug-bar">
          <button onClick={() => setShowDebug(v => !v)} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 5,
            padding: '0.12rem 0.45rem', color: 'var(--muted)', fontSize: '0.58rem',
            cursor: 'pointer', fontFamily: 'DM Mono, monospace'
          }}>
            {showDebug ? '▲' : '▼'} cols ({detectedCols.length})
          </button>
          {showDebug && detectedCols.map(c => (
            <span key={c} style={{
              fontSize: '0.57rem', fontFamily: 'DM Mono, monospace',
              padding: '0.08rem 0.3rem', borderRadius: 4,
              background: 'var(--s2)', border: '1px solid var(--border)',
              color: ['NOMBRE', 'TELEFONO', 'TELÉFONO'].includes(c.toUpperCase().trim())
                ? 'var(--green)' : 'var(--muted)'
            }}>{c}</span>
          ))}
        </div>
      )}

      {/* ── ÁREA DE TABLA — flex:1, overflow:auto, thead sticky top:0 ── */}
      <div className="tbl-area">
        {loading ? (
          <div className="center"><div className="spinner" /><span className="empty-txt">Cargando…</span></div>
        ) : error ? (
          <div className="center">
            <div className="empty-icon">⚠️</div>
            <div className="empty-txt">Error: {error}</div>
            <button className="btn btn-accent" onClick={fetchData}>Reintentar</button>
          </div>
        ) : tab === 'reservas' ? (
          <>
            {displayed.length === 0 ? (
              <div className="center"><div className="empty-icon">🏖️</div><div className="empty-txt">Sin reservas con ese filtro.</div></div>
            ) : (
              <div className="tbl-padding">
                <table>
                  <thead>
                    <tr>
                      <th>Alojamiento</th>
                      <th>Origen</th>
                      <th>Entrada</th>
                      <th>Salida</th>
                      <th style={{ textAlign: 'center' }}>Noches</th>
                      <th>Teléfono</th>
                      <th>Acción</th>
                      <th>Observaciones</th>
                      <th>Datos Kiko</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.flatMap(row => {
                      const id = row._id;
                      const isExp = expandedRow === id;
                      const eHoy = isToday(row._entrada);
                      const sHoy = isToday(row._salida);
                      const dIn  = daysDiff(row._entrada);
                      const dOut = daysDiff(row._salida);
                      const isCalled = called[id];
                      const phone = phones[id] || '';
                      const sheetPhone = safeGet(row, keys.telefono) !== '—' ? safeGet(row, keys.telefono) : '';
                      const displayPhone = phone || sheetPhone;
                      let nights = '—';
                      if (row._entrada && row._salida)
                        nights = Math.round((row._salida - row._entrada) / 86400000);

                      return [
                        <tr
                          key={`r${id}`}
                          className={`${eHoy ? 'in-today' : sHoy ? 'out-today' : ''} ${isCalled ? 'is-called' : ''}`}
                          onClick={() => setExpandedRow(isExp ? null : id)}
                        >
                          {/* 1 — Alojamiento + NOMBRE */}
                          <td>
                            <div className="cell-truncate cell-aloj">{safeGet(row, keys.alojamiento)}</div>
                            {safeGet(row, keys.nombre) !== '—' && (
                              <div className="cell-truncate cell-nombre">{safeGet(row, keys.nombre)}</div>
                            )}
                          </td>

                          {/* 2 — Origen */}
                          <td>
                            <span className={`bdg ${row._origen.includes('booking') ? 'bdg-bk' : 'bdg-ab'}`}>
                              {row._origen.includes('booking') ? '✈' : '🏠'} {safeGet(row, keys.origen)}
                            </span>
                          </td>

                          {/* 3 — Entrada */}
                          <td>
                            <span className="mono">{formatDate(row._entrada)}</span>
                            {eHoy && <span className="tag tag-in">HOY ✈</span>}
                            {!eHoy && dIn !== null && dIn > 0 && dIn <= 30 && <span className="days-lbl">+{dIn}d</span>}
                          </td>

                          {/* 4 — Salida */}
                          <td>
                            <span className="mono">{formatDate(row._salida)}</span>
                            {sHoy && <span className="tag tag-out">HOY 🚪</span>}
                            {!sHoy && dOut !== null && dOut > 0 && dOut <= 30 && <span className="days-lbl">+{dOut}d</span>}
                          </td>

                          {/* 5 — Noches */}
                          <td className="mono" style={{ textAlign: 'center', color: 'var(--muted)' }}>{nights}</td>

                          {/* 6 — Teléfono */}
                          <td className="ac" onClick={e => e.stopPropagation()}>
                            <div className="phone-cell">
                              {editingPhone === id ? (
                                <>
                                  <input
                                    className="phone-input" value={phoneInput}
                                    placeholder="+34 600 000 000"
                                    onChange={e => setPhoneInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') savePhone(id); if (e.key === 'Escape') setEditingPhone(null); }}
                                    autoFocus
                                  />
                                  <button className="btn btn-accent btn-xs" onClick={() => savePhone(id)}>✓</button>
                                  <button className="btn btn-ghost btn-xs" onClick={() => setEditingPhone(null)}>✕</button>
                                </>
                              ) : (
                                <>
                                  {displayPhone
                                    ? <span className={phone ? 'phone-val' : 'phone-sheet'}>{displayPhone}</span>
                                    : <span className="phone-empty">Sin tel.</span>
                                  }
                                  <button className="btn btn-ghost btn-xs"
                                    onClick={() => { setEditingPhone(id); setPhoneInput(phone || sheetPhone); }}>✏️</button>
                                </>
                              )}
                            </div>
                          </td>

                          {/* 7 — Acción */}
                          <td className="ac" onClick={e => e.stopPropagation()}>
                            <button
                              className={`btn btn-xs ${isCalled ? 'btn-called' : 'btn-call'}`}
                              onClick={() => setCalled(p => ({ ...p, [id]: !p[id] }))}
                            >
                              {isCalled ? '✅ Llamado' : '📞 Llamar'}
                            </button>
                          </td>

                          {/* 8 — Observaciones */}
                          <td><div className="cell-truncate cell-obs">{safeGet(row, keys.observaciones)}</div></td>

                          {/* 9 — Datos Kiko */}
                          <td><div className="cell-truncate cell-kiko">{safeGet(row, keys.datosKiko)}</div></td>
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
                                      <span>{String(v)}</span>
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
            <div className="footer-bar">
              {displayed.length} reservas · {data.length} total · Haz clic en una fila para ver todos los datos
            </div>
          </>
        ) : (
          /* ── Pestaña Financiero ── */
          <>
            <div className="tbl-padding">
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>Alojamiento</th>
                    <th>Origen</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>Cobrado A</th>
                    <th>Cobrado B</th>
                    <th>Total Cobrado</th>
                    <th>Ingreso Canal Neto</th>
                    <th>Fecha Pago</th>
                    <th>2º Ingreso Neto</th>
                    <th>Fecha Pago 2</th>
                    <th>Reportes</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(row => (
                    <tr key={row._id}>
                      <td style={{ fontWeight: 600 }}>{safeGet(row, keys.alojamiento)}</td>
                      <td>
                        <span className={`bdg ${row._origen.includes('booking') ? 'bdg-bk' : 'bdg-ab'}`}>
                          {safeGet(row, keys.origen)}
                        </span>
                      </td>
                      <td className="mono" style={{ fontSize: '0.72rem' }}>{formatDate(row._entrada)}</td>
                      <td className="mono" style={{ fontSize: '0.72rem' }}>{formatDate(row._salida)}</td>
                      <td className="money">{formatMoney(row[keys.cobradoA])}</td>
                      <td className="money">{formatMoney(row[keys.cobradoB])}</td>
                      <td className="money" style={{ fontWeight: 700 }}>{formatMoney(row[keys.totalCobrado])}</td>
                      <td className="money">{formatMoney(row[keys.ingresoCanal])}</td>
                      <td className="mono" style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{safeGet(row, keys.fechaPago)}</td>
                      <td className="money">{formatMoney(row[keys.segundoIngreso])}</td>
                      <td className="mono" style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{safeGet(row, keys.fechaPago2)}</td>
                      <td style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{safeGet(row, keys.reportes)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan={4} style={{ textAlign: 'right', color: 'var(--muted)', fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      TOTALES — {displayed.length} reservas
                    </td>
                    <td className="money" style={{ color: 'var(--muted)' }}>—</td>
                    <td className="money" style={{ color: 'var(--muted)' }}>—</td>
                    <td className="money" style={{ color: 'var(--accent)', fontWeight: 800 }}>
                      {formatMoney(displayed.reduce((s, r) => {
                        const v = parseFloat(String(r[keys.totalCobrado] || '').replace(/[€$£\s]/g, '').replace(/\./g, '').replace(',', '.'));
                        return s + (isNaN(v) ? 0 : v);
                      }, 0))}
                    </td>
                    <td className="money" style={{ color: 'var(--green)', fontWeight: 800 }}>
                      {formatMoney(displayed.reduce((s, r) => {
                        const v = parseFloat(String(r[keys.ingresoCanal] || '').replace(/[€$£\s]/g, '').replace(/\./g, '').replace(',', '.'));
                        return s + (isNaN(v) ? 0 : v);
                      }, 0))}
                    </td>
                    <td colSpan={4} />
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="footer-bar">
              {displayed.length} reservas · COBRADO A · COBRADO B · TOTAL COBRADO · INGRESO CANAL NETO
            </div>
          </>
        )}
      </div>
    </>
  );
}
