import { useEffect, useMemo, useState } from 'react';
import { socket } from '../lib/ws';

// only set keys that actually arrive
function normalizePresence(p) {
  const out = { crewId: p.crewId };
  if ('name' in p) out.name = p.name;
  if ('onDuty' in p || 'on_duty' in p || 'onduty' in p) out.onDuty = p.onDuty ?? p.on_duty ?? p.onduty;
  if ('busy' in p) out.busy = p.busy;
  if ('deck_zone' in p || 'deckZone' in p || 'zone' in p) out.deck_zone = p.deck_zone ?? p.deckZone ?? p.zone;
  if ('inTreatment' in p || 'in_treatment' in p || 'treatment' in p)
    out.inTreatment = !!(p.inTreatment ?? p.in_treatment ?? p.treatment);
  if ('ts' in p) out.ts = p.ts;
  if (!('ts' in p) && (('onDuty' in out) || ('busy' in out) || ('deck_zone' in out) || ('inTreatment' in out))) {
    out.ts = new Date().toISOString();
  }
  return out;
}

export default function usePresence() {
  const [byId, setById] = useState(() => new Map());

  // seed
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch('/api/crew/presence');
      const data = await res.json();
      if (!alive) return;
      const m = new Map();
      for (const r of data) m.set(r.crewId, r);
      setById(m);
    })();
    return () => { alive = false; };
  }, []);

  // live
  useEffect(() => {
    const onUpdate = (payload) => {
      const p = normalizePresence(payload);
      setById(prev => {
        const m = new Map(prev);
        const cur = m.get(p.crewId) || { crewId: p.crewId };
        m.set(p.crewId, { ...cur, ...p });
        return m;
      });
    };
    socket.on('presence:update', onUpdate);
    return () => socket.off('presence:update', onUpdate);
  }, []);

  // raw list from map
  const rawList = useMemo(
    () => Array.from(byId.values()).sort((a,b)=>(a.name||'').localeCompare(b.name||'')),
    [byId]
  );

  // enrich with effective flags
  const list = useMemo(() => {
    return rawList.map(r => {
      const inferredTreatment = r.deck_zone === 'Sickbay' && r.onDuty === false;
      const inTreatment = ('inTreatment' in r) ? !!r.inTreatment : inferredTreatment;
      const onDuty = inTreatment ? false : !!r.onDuty;
      const busy = onDuty ? !!r.busy : false; // never mark patients as busy
      const deck_zone = inTreatment ? 'Sickbay' : (r.deck_zone || '—');
      return { ...r, inTreatment, onDuty, busy, deck_zone };
    });
  }, [rawList]);

  // derived stats (busy excludes patients)
  const derived = useMemo(() => {
    const total = list.length;
    const onDuty = list.filter(x => x.onDuty === true).length;
    const busy   = list.filter(x => x.onDuty === true && x.busy === true).length;
    const treatment = list.filter(x => x.inTreatment === true).length;
    const offDuty = Math.max(0, total - onDuty);
    // zones among on-duty crew only (patients excluded)
    const zoneCounts = new Map();
    for (const c of list) if (c.onDuty) {
      const z = c.deck_zone || '—';
      zoneCounts.set(z, (zoneCounts.get(z) || 0) + 1);
    }
    const topZones = [...zoneCounts.entries()].sort((a,b)=>b[1]-a[1]);
    let max = 0; for (const c of list) { const t = c?.ts ? Date.parse(c.ts) : 0; if (t>max) max=t; }
    return {
      total, onDuty, busy, offDuty, treatment,
      busyPctOfOnDuty: onDuty ? Math.round((busy/onDuty)*100) : 0,
      topZones,
      lastUpdated: max ? new Date(max).toISOString() : null,
    };
  }, [list]);

  const summary = useMemo(() => ({
    total: derived.total,
    onDuty: derived.onDuty,
    busy: derived.busy,
    busyPct: derived.onDuty ? Math.round((derived.busy/derived.onDuty)*100) : 0,
    ts: derived.lastUpdated,
  }), [derived.total, derived.onDuty, derived.busy, derived.lastUpdated]);

  return {
    list, summary,
    total: derived.total,
    onDutyCount: derived.onDuty,
    busyCount: derived.busy,
    treatmentCount: derived.treatment,
    offDutyCount: derived.offDuty,
    busyPctOfOnDuty: derived.busyPctOfOnDuty,
    topZones: derived.topZones,
    lastUpdated: derived.lastUpdated,
  };
}
