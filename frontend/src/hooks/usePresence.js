import { useEffect, useMemo, useRef, useState } from 'react';
import { socket } from '../lib/ws';

function deriveSummary(map) {
  const list = Array.from(map.values());
  const total  = list.length;
  const onDuty = list.filter(x => x.onDuty === true).length;
  const busy   = list.filter(x => x.onDuty === true && x.busy === true).length;
  const busyPct = total ? Math.round((busy / total) * 100) : 0; // or busy/onDuty if you prefer
  return { total, onDuty, busy, busyPct, ts: new Date().toISOString() };
}

// ✅ only set keys that are actually present in the payload
function normalizePresence(p) {
  const out = { crewId: p.crewId };
  if ('name' in p) out.name = p.name;
  if ('ts' in p) out.ts = p.ts;

  if ('onDuty' in p || 'on_duty' in p || 'onduty' in p) {
    out.onDuty = p.onDuty ?? p.on_duty ?? p.onduty;
  }
  if ('busy' in p) {
    out.busy = p.busy;
  }
  if ('deck_zone' in p || 'deckZone' in p || 'zone' in p) {
    out.deck_zone = p.deck_zone ?? p.deckZone ?? p.zone;
  }
  return out;
}

export default function usePresence() {
  const [byId, setById] = useState(() => new Map());
  const [serverSummary, setServerSummary] = useState(null); // optional: keep for debugging/compare
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      const res = await fetch('/api/crew/presence');
      const data = await res.json();
      if (!mounted.current) return;
      const m = new Map();
      for (const r of data) m.set(r.crewId, r); // full snapshot already shaped: onDuty/busy/deck_zone present
      setById(m);
    })();
    return () => { mounted.current = false; };
  }, []);

  // live updates
  useEffect(() => {
    const onUpdate = (payload) => {
      const p = normalizePresence(payload);
      setById(prev => {
        const m = new Map(prev);
        const cur = m.get(p.crewId) || { crewId: p.crewId };
        // merge only provided keys; nothing gets defaulted to false anymore
        m.set(p.crewId, { ...cur, ...p });
        return m;
      });
    };

    const onSummary = (s) => {
      // don't let server summary override header; keep only for optional display
      setServerSummary(s);
    };

    socket.on('presence:update', onUpdate);
    socket.on('presence:summary', onSummary);
    return () => {
      socket.off('presence:update', onUpdate);
      socket.off('presence:summary', onSummary);
    };
  }, []);

  // 🔒 header numbers always derived from the same data the table uses
  const list = useMemo(
    () => Array.from(byId.values()).sort((a,b) => (a.name||'').localeCompare(b.name||'')),
    [byId]
  );
  const summary = useMemo(() => deriveSummary(byId), [byId]);
  const onDuty = useMemo(() => list.filter(x => x.onDuty === true), [list]);
  const busy   = useMemo(() => list.filter(x => x.onDuty === true && x.busy === true), [list]);

  return { list, byId, onDuty, busy, summary, serverSummary };
}
