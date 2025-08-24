import { useEffect, useMemo, useState } from "react";
import Sparkline from "../ui/Sparkline";
import Pill from "../ui/Pill";

export default function HistorySection({ crewId }) {
  const [tab, setTab] = useState('visits');

  return (
    <section className="bg-black/40 border border-zinc-800 rounded-xl">
      <div className="sticky top-0 z-10 bg-black/60 border-b border-zinc-800 px-3 pt-2">
        <div className="text-[rgb(var(--lcars-amber))] font-extrabold tracking-widest mb-2">
          HISTORY
        </div>
        <nav className="flex gap-2">
          {['visits','vitals','notes'].map(k => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3 py-2 text-xs rounded-t-md border-b-2 -mb-px
                ${tab===k ? 'border-[rgb(var(--lcars-amber))] text-amber-200' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
            >
              {k.toUpperCase()}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-3 space-y-3">
        {tab === 'visits' && <VisitsHistoryTab crewId={crewId} />}
        {tab === 'vitals' && <VitalsHistoryTab crewId={crewId} />}
        {tab === 'notes'  && <NotesHistoryTab crewId={crewId} />}
      </div>
    </section>
  );
}

/* --- VISITS --- */
function VisitsHistoryTab({ crewId }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  async function loadPage(next) {
    setLoading(true); setErr(null);
    try {
      const qs = new URLSearchParams({ limit: '10' });
      if (next?.cursor_started_at) {
        qs.set('cursor_started_at', next.cursor_started_at);
        qs.set('cursor_id', String(next.cursor_id));
      }
      const r = await fetch(`/api/triage/crew/${crewId}/visits?`+qs.toString());
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const j = await r.json();
      const list = Array.isArray(j) ? j : (j.items || []);
      const nc   = Array.isArray(j) ? null : (j.nextCursor || null);
      setItems(prev => next ? [...prev, ...list] : list);
      setCursor(nc);
    } catch (e) { setErr(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadPage(null); /* eslint-disable-next-line */ }, [crewId]);

  return (
    <div>
      {err && <div className="text-red-400 text-xs">Error: {String(err.message||err)}</div>}
      <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded">
        {items.map(v => (
          <li key={v.id} className="p-3 flex gap-4">
            <div className="min-w-[92px] text-[11px] text-zinc-400">
              <div>{fmtDate(v.started_at)}</div>
              <div>{durationLabel(v.started_at, v.ended_at)}</div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-xs">
                <Pill tone="info">acuity {v.acuity ?? '—'}</Pill>
                {v.bed && <Pill className="!bg-zinc-800 !text-zinc-200">{v.bed}</Pill>}
                {v.assigned_to && <Pill className="!bg-zinc-800 !text-zinc-200">assigned {v.assigned_to}</Pill>}
              </div>
              <div className="mt-1 text-sm"><span className="text-zinc-400">Complaint:</span> {v.complaint || '—'}</div>
              <VisitTimeline states={v.state_path || (v.state ? [v.state] : [])} />
            </div>
          </li>
        ))}
        {items.length===0 && !loading && <li className="p-6 text-center text-sm text-zinc-400">No visits yet.</li>}
      </ul>
      <div className="mt-2 flex justify-end">
        {cursor && (
          <button onClick={() => loadPage(cursor)} className="px-3 py-1 text-sm border border-zinc-700 rounded hover:bg-white/5">
            Load more
          </button>
        )}
      </div>
      {loading && <div className="text-xs text-zinc-400 mt-2">Loading…</div>}
    </div>
  );
}

function VisitTimeline({ states }) {
  if (!states?.length) return null;
  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      {states.map((s,i)=>(
        <span key={i} className="text-xs text-zinc-300">
          {i===0 ? '●' : '○'} {s.replace(/_/g,' ')}
        </span>
      ))}
    </div>
  );
}

/* --- VITALS --- */
function VitalsHistoryTab({ crewId }) {
  const [win, setWin] = useState('2h');
  const [bucket, setBucket] = useState('30s');
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    async function go() {
      setLoading(true); setErr(null);
      try {
        const r = await fetch(`/api/crew/${crewId}/series?window=${encodeURIComponent(win)}&bucket=${encodeURIComponent(bucket)}`);
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        const j = await r.json();
        if (alive) setData(j);
      } catch (e) { alive && setErr(e); }
      finally { alive && setLoading(false); }
    }
    go(); return () => { alive = false; };
  }, [crewId, win, bucket]);

  const metrics = useMemo(() => data ? Object.entries(data) : [], [data]);

  return (
    <div>
      <div className="flex gap-3 text-xs mb-2">
        <label className="flex items-center gap-1">Window
          <select value={win} onChange={e=>setWin(e.target.value)} className="bg-black border border-zinc-700 rounded px-2 py-1">
            <option>30m</option><option>1h</option><option>2h</option><option>6h</option>
          </select>
        </label>
        <label className="flex items-center gap-1">Bucket
          <select value={bucket} onChange={e=>setBucket(e.target.value)} className="bg-black border border-zinc-700 rounded px-2 py-1">
            <option>10s</option><option>30s</option><option>1m</option><option>5m</option>
          </select>
        </label>
      </div>

      {err && <div className="text-red-400 text-xs mb-2">Error: {String(err.message||err)}</div>}
      {loading && <div className="text-xs text-zinc-400 mb-2">Loading…</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {metrics.map(([name, rows]) => (
          <div key={name} className="border border-zinc-800 rounded-lg p-3 bg-black/30">
            <div className="flex items-center justify-between mb-1">
              <div className="capitalize text-zinc-300">{name.replace(/_/g,' ')}</div>
              <div className="text-sm font-semibold">{rows?.length ? rows[rows.length-1].value : '—'}</div>
            </div>
            <Sparkline data={rows || []} />
            <div className="flex justify-between text-[11px] text-zinc-400 mt-1">
              <span>min {rows?.length ? Math.min(...rows.map(r=>+r.value)) : '—'}</span>
              <span>max {rows?.length ? Math.max(...rows.map(r=>+r.value)) : '—'}</span>
            </div>
          </div>
        ))}
        {(!metrics || metrics.length===0) && !loading && <div className="text-sm text-zinc-400">No data.</div>}
      </div>
    </div>
  );
}

/* --- NOTES --- */
function NotesHistoryTab({ crewId }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/crew/${crewId}/notes?limit=50`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
      .then(j => { if (alive) setItems(Array.isArray(j)? j : (j?.items || [])); })
      .catch(e => alive && setErr(e));
    return () => { alive = false; };
  }, [crewId]);

  if (err) {
    return <div className="text-yellow-300 text-xs">Notes API unavailable.</div>;
  }
  if (!items) return <div className="text-xs text-zinc-400">Loading…</div>;
  if (items.length === 0) return <div className="text-sm text-zinc-400">No notes yet.</div>;

  return (
    <ul className="space-y-2">
      {items.map(n => (
        <li key={n.id} className="border border-zinc-800 rounded p-3 bg-black/30">
          <div className="text-[11px] text-zinc-400 flex items-center gap-2">
            <span>{fmtDate(n.at)}</span>
            {n.author && <span>• {n.author}</span>}
          </div>
          <div className="mt-1 text-sm text-zinc-200 whitespace-pre-wrap">{n.body}</div>
          {Array.isArray(n.tags) && n.tags.length>0 && (
            <div className="mt-1 flex gap-1 flex-wrap">
              {n.tags.map((t,i)=> <Pill key={i} className="!bg-zinc-800 !text-zinc-200">{t}</Pill>)}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/* small helpers for this block */
function fmtDate(iso) {
  try {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString([], { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  } catch { return String(iso||'—'); }
}
function durationLabel(startIso, endIso) {
  try {
    const s = new Date(startIso);
    const e = endIso ? new Date(endIso) : new Date();
    const mins = Math.floor(Math.max(0, e - s) / 60000);
    const h = Math.floor(mins/60), d = Math.floor(h/24);
    if (d>0) return `${d}d ${h%24}h`;
    if (h>0) return `${h}h ${mins%60}m`;
    return `${mins}m`;
  } catch { return '—'; }
}
