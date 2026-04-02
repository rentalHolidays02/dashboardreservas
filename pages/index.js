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
    .header { flex-shrink: 0; position: sticky; top: 0; z-index: 100; background: var(--s1); border-bottom: 1px solid var(--border); padding: 0.7rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; flex-wrap: wrap; }
    .logo { font-size: 1rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem; }
    .logo-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
    .hdr-r { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
    .last-upd { font-family: 'DM Mono', monospace; font-size: 0.67rem; color: var(--muted); }
    @media(max-width:480px) { .tog-lbl-text { display: none; } }
    .alarm-banner { flex-shrink: 0; position: sticky; top: var(--header-h, 56px); z-index: 99; background: rgba(248,113,113,0.07); border-bottom: 1px solid rgba(248,113,113,0.25); padding: 0.55rem 1rem; display: flex; align-items: center; gap: 0.6rem; }
    .bell { font-size: 1.1rem; animation: ring 0.55s ease-in-out infinite; display: inline-block; }
    @keyframes ring { 0%,100%{transform:rotate(-12deg)} 50%{transform:rotate(12deg)} }
    .alarm-title { font-weight: 700; font-size: 0.8rem; color: var(--red); }
    .alarm-detail { font-size: 0.68rem; margin-top: 0.1rem; }
    .tabs { flex-shrink: 0; position: sticky; top: var(--header-tabs-h, 94px); z-index: 98; display: flex; border-bottom: 1px solid var(--border); background: var(--s1); padding: 0 1rem; }
    .tab-btn { padding: 0.65rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-family: 'Syne', sans-serif; font-size: 0.72rem; font-weight: 700; color: var(--muted); transition: all 0.15s; margin-bottom: -1px; text-transform: uppercase; letter-spacing: 0.06em; }
    .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
    .stats { flex-shrink: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; padding: 0.75rem 1rem; }
    @media(min-width:600px) { .stats { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); } }
    .stat { background: var(--s1); border: 1px solid var(--border); border-radius: 10px; padding: 0.6rem 0.75rem; }
    .stat-label { font-size: 0.58rem; color: var(--muted); text-transform: uppercase; margin-bottom: 0.25rem; }
    .stat-val { font-size: 1.4rem; font-weight: 800; line-height: 1.1; }
    .stat-sub { font-size: 0.58rem; color: var(--muted); margin-top: 0.12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .controls { flex-shrink: 0; padding: 0 1rem 0.65rem; display: flex; gap: 0.35rem; flex-wrap: wrap; align-items: center; }
    .search { background: var(--s1); border: 1px solid var(--border); border-radius: 7px; padding: 0.42rem 0.85rem; color: var(--text); font-family: 'DM Mono', monospace; font-size: 0.78rem; width: 100%; outline: none; flex: 1 1 160px; }
    .fbtn { background: var(--s1); border: 1px solid var(--border); border-radius: 7px; padding: 0.36rem 0.65rem; color: var(--muted); cursor: pointer; font-family: 'Syne', sans-serif; font-size: 0.68rem; font-weight: 700; transition: all 0.15s; white-space: nowrap; }
    .fbtn.on.def { background: var(--accent); border-color: var(--accent); color: #fff; }
    .fbtn.on.gr  { background: rgba(52,211,153,0.18); border-color: var(--green); color: var(--green); }
    .fbtn.on.yl  { background: rgba(251,191,36,0.18); border-color: var(--yellow); color: var(--yellow); }
    .fbtn.on.pu  { background: rgba(167,139,250,0.18); border-color: var(--purple); color: var(--purple); }
    .fbtn.on.bk  { background: var(--booking); border-color: var(--booking); color: #fff; }
    .fbtn.on.ab  { background: var(--airbnb); border-color: var(--airbnb); color: #fff; }
    .tbl-area { flex: 1; overflow: auto; min-height: 0; }
    .desktop-table { display: none; }
    @media(min-width:700px) { .desktop-table { display: block; } .mobile-cards { display: none; } }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; min-width: 820px; }
    thead th { position: sticky; top: 0; z-index: 10; background: var(--s1); border-bottom: 2px solid var(--border2); padding: 0.6rem 0.85rem; text-align: left; font-size: 0.63rem; font-weight: 700; text-transform: uppercase; color: var(--muted); }
    tbody tr { border-bottom: 1px solid var(--border); cursor: pointer; }
    tbody tr:hover { background: var(--s2); }
    .in-today { border-left: 3px solid var(--green); }
    .out-today { border-left: 3px solid var(--yellow); }
    .cell-truncate { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cell-aloj { max-width: 155px; font-weight: 700; }
    .cell-obs-in { max-width: 155px; color: var(--green); font-size: 0.7rem; }
    .cell-obs-out { max-width: 155px; color: var(--yellow); font-size: 0.7rem; }
    .mobile-cards { display: flex; flex-direction: column; padding: 0; }
    .res-card { background: var(--s1); border-bottom: 1px solid var(--border); padding: 0.85rem 1rem; cursor: pointer; position: relative; }
    .card-top { display: flex; justify-content: space-between; margin-bottom: 0.45rem; }
    .card-aloj { font-weight: 800; font-size: 0.92rem; }
    .card-dates { display: flex; gap: 0.4rem; margin-bottom: 0.45rem; align-items: center; }
    .card-date-val { font-family: 'DM Mono', monospace; font-size: 0.82rem; }
    .card-obs-box { margin-top: 0.6rem; display: flex; flex-direction: column; gap: 0.35rem; }
    .card-obs-item { font-size: 0.72rem; padding-left: 0.6rem; }
    .bdg { padding: 0.15rem 0.48rem; border-radius: 5px; font-size: 0.62rem; font-weight: 700; text-transform: uppercase; }
    .bdg-bk { background: rgba(26,86,219,0.18); color: #93c5fd; border: 1px solid rgba(26,86,219,0.35); }
    .bdg-ab { background: rgba(255,56,92,0.15); color: #fca5a5; border: 1px solid rgba(255,56,92,0.28); }
    .tag { padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.57rem; font-weight: 700; margin-left: 0.3rem; }
    .tag-in { background: rgba(52,211,153,0.13); color: var(--green); border: 1px solid rgba(52,211,153,0.22); }
    .tag-out { background: rgba(251,191,36,0.13); color: var(--yellow); border: 1px solid rgba(251,191,36,0.22); }
    .btn { padding: 0.26rem 0.62rem; border-radius: 6px; cursor: pointer; font-size: 0.7rem; font-weight: 700; }
    .btn-call { background: rgba(56,189,248,0.1); color: var(--accent2); border: 1px solid rgba(56,189,248,0.22); }
    .btn-called { background: rgba(52,211,153,0.1); color: var(--green); border: 1px solid rgba(52,211,153,0.22); }
    .money { font-family: 'DM Mono', monospace; text-align: right; color: var(--green); }
    .footer-bar { padding: 0.65rem 1rem; color: var(--muted); font-size: 0.67rem; font-family: 'DM Mono', monospace; border-top: 1px solid var(--border); }
  `;

  function MobileCard({ row }) {
    const id = row._id;
    const isExp = expandedRow === id;
    const eHoy = isToday(row._entrada);
    const sHoy = isToday(row._salida);
    const isCalled = called[id];
    const displayPhone = phones[id] || (safeGet(row, keys.telefono) !== '—' ? safeGet(row, keys.telefono) : '');
    
    return (
      <div className={`res-card ${eHoy ? 'in-today' : sHoy ? 'out-today' : ''} ${isCalled ? 'is-called' : ''}`} onClick={() => setExpandedRow(isExp ? null : id)}>
        <div className="card-top">
          <div>
            <div className="card-aloj">{safeGet(row, keys.alojamiento)}</div>
            <div style={{fontSize:'0.7rem', color:'var(--muted)'}}>{safeGet(row, keys.nombre)}</div>
          </div>
          <span className={`bdg ${row._origen.includes('booking') ? 'bdg-bk' : 'bdg-ab'}`}>
            {row._origen.includes('booking') ? '✈' : '🏠'} {safeGet(row, keys.origen)}
          </span>
        </div>
        <div className="card-dates">
          <span className="card-date-val">{formatDate(row._entrada)} {eHoy && <span className="tag tag-in">HOY</span>}</span>
          <span style={{color:'var(--muted)'}}>→</span>
          <span className="card-date-val">{formatDate(row._salida)} {sHoy && <span className="tag tag-out">HOY</span>}</span>
        </div>
        
        {/* Nueva sección de Observaciones */}
        <div className="card-obs-box">
          {safeGet(row, keys.obsEntrada) !== '—' && (
            <div className="card-obs-item" style={{borderLeft:'2px solid var(--green)', color:'var(--green)'}}>
              <b>📥 ENTRADA:</b> {safeGet(row, keys.obsEntrada)}
            </div>
          )}
          {safeGet(row, keys.obsSalida) !== '—' && (
            <div className="card-obs-item" style={{borderLeft:'2px solid var(--yellow)', color:'var(--yellow)'}}>
              <b>📤 SALIDA:</b> {safeGet(row, keys.obsSalida)}
            </div>
          )}
        </div>

        <div style={{marginTop:'0.8rem', display:'flex', gap:'0.5rem'}} onClick={e => e.stopPropagation()}>
          <span style={{fontFamily:'DM Mono', fontSize:'0.8rem', flex:1}}>{displayPhone || 'Sin tel.'}</span>
          <button className={`btn ${isCalled ? 'btn-called' : 'btn-call'}`} onClick={() => setCalled(p => ({ ...p, [id]: !p[id] }))}>
            {isCalled ? '✅' : '📞 Llamar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Dashboard Reservas</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono&display=swap" rel="stylesheet" />
        <style>{CSS}</style>
      </Head>

      <header className="header" ref={headerRef}>
        <div className="logo"><div className="logo-dot" /> Reservas</div>
        <div className="hdr-r">
          {lastUpdate && <span className="last-upd">↻ {lastUpdate.toLocaleTimeString()}</span>}
          <button className="btn btn-call" style={{padding:'0.2rem 0.5rem'}} onClick={() => fetchData()}>↻</button>
        </div>
      </header>

      {hasToday && alarmsEnabled && (
        <div className="alarm-banner" ref={bannerRef}>
          <span className="bell">🔔</span>
          <div className="alarm-title">Hay movimientos hoy ({todayIn.length} Ent. / {todayOut.length} Sal.)</div>
        </div>
      )}

      <div className="tabs" ref={tabsRef}>
        <button className={`tab-btn ${tab === 'reservas' ? 'active' : ''}`} onClick={() => setTab('reservas')}>📅 Reservas</button>
        <button className={`tab-btn ${tab === 'financiero' ? 'active' : ''}`} onClick={() => setTab('financiero')}>💶 Financiero</button>
      </div>

      <div className="controls">
        <input className="search" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className={`fbtn ${filter === 'all' ? 'on def' : ''}`} onClick={() => setFilter('all')}>Todas</button>
        <button className={`fbtn ${filter === 'today_in' ? 'on gr' : ''}`} onClick={() => setFilter('today_in')}>📥</button>
        <button className={`fbtn ${filter === 'today_out' ? 'on yl' : ''}`} onClick={() => setFilter('today_out')}>📤</button>
      </div>

      <div className="tbl-area">
        {loading ? (
          <div style={{padding:'2rem', textAlign:'center'}}>Cargando...</div>
        ) : tab === 'reservas' ? (
          <>
            <div className="desktop-table" style={{padding:'0 1rem'}}>
              <table>
                <thead>
                  <tr>
                    <th>Alojamiento</th>
                    <th>Origen</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>Teléfono</th>
                    <th>Obs. Entrada</th>
                    <th>Obs. Salida</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(row => (
                    <tr key={row._id} className={`${isToday(row._entrada) ? 'in-today' : isToday(row._salida) ? 'out-today' : ''}`}>
                      <td className="cell-aloj">{safeGet(row, keys.alojamiento)}</td>
                      <td><span className={`bdg ${row._origen.includes('booking') ? 'bdg-bk' : 'bdg-ab'}`}>{safeGet(row, keys.origen)}</span></td>
                      <td className="mono">{formatDate(row._entrada)}</td>
                      <td className="mono">{formatDate(row._salida)}</td>
                      <td className="mono">{phones[row._id] || safeGet(row, keys.telefono)}</td>
                      <td className="cell-obs-in">{safeGet(row, keys.obsEntrada)}</td>
                      <td className="cell-obs-out">{safeGet(row, keys.obsSalida)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-cards">
              {displayed.map(row => <MobileCard key={row._id} row={row} />)}
            </div>
          </>
        ) : (
          <div style={{padding:'1rem', overflowX:'auto'}}>
            <table style={{minWidth:'1000px'}}>
              <thead>
                <tr>
                  <th>Alojamiento</th>
                  <th>Total Cobrado</th>
                  <th>Ingreso Neto</th>
                  <th>Fecha Pago</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(row => (
                  <tr key={row._id}>
                    <td>{safeGet(row, keys.alojamiento)}</td>
                    <td className="money">{formatMoney(row[keys.totalCobrado])}</td>
                    <td className="money" style={{color:'var(--accent2)'}}>{formatMoney(row[keys.ingresoCanal])}</td>
                    <td className="mono">{safeGet(row, keys.fechaPago)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <footer className="footer-bar">{displayed.length} resultados</footer>
    </>
  );
}
