import { useEffect, useMemo, useState } from "react";
import { socket } from "../lib/ws";

const METRICS = "heart_rate,o2_sat,body_temp";
const DEFAULT_WINDOW = "2h";
const DEFAULT_BUCKET = "30s";

export default function useCrewOverview(crewId) {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [series, setSeries] = useState({ heart_rate: [], o2_sat: [], body_temp: [] });
  const [error, setError] = useState(null);

  // seed overview
  useEffect(() => {
    if (!crewId) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/crew/${crewId}/overview`);
        if (!res.ok) throw new Error(`overview ${res.status}`);
        const data = await res.json();
        if (alive) setOverview(data);
      } catch (e) {
        if (alive) setError(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [crewId]);

  // seed series (sparklines)
  useEffect(() => {
    if (!crewId) return;
    let alive = true;
    (async () => {
      try {
        const url = `/api/crew/${crewId}/series?metrics=${METRICS}&window=${DEFAULT_WINDOW}&bucket=${DEFAULT_BUCKET}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`series ${res.status}`);
        const data = await res.json();
        if (alive) setSeries({
          heart_rate: data.heart_rate || [],
          o2_sat: data.o2_sat || [],
          body_temp: data.body_temp || [],
        });
      } catch (e) {
        if (alive) setError(e);
      }
    })();
    return () => { alive = false; };
  }, [crewId]);

  // live updates: presence & triage (reuse existing WS events)
  useEffect(() => {
    if (!crewId) return;
    const onPresence = (p) => {
      if (p.crewId !== crewId) return;
      setOverview(prev => prev ? { ...prev, presence: { ...prev.presence, ...p } } : prev);
    };
    const onTriage = (u) => {
      // If this crew’s active visit changes, merge; if none exists, create a minimal stub
      if (u.crewId !== crewId) return;
      setOverview(prev => {
        if (!prev) return prev;
        const isActive = prev.triageActive && prev.triageActive.visitId === u.id;
        if (!isActive && !prev.triageActive && u.state && !u.ended_at) {
          return { ...prev, triageActive: {
            visitId: u.id, state: u.state, acuity: u.acuity ?? prev?.triageActive?.acuity ?? null,
            complaint: prev?.triageActive?.complaint ?? null, bed: u.bed ?? null,
            assigned_to: prev?.triageActive?.assigned_to ?? null, started_at: prev?.triageActive?.started_at ?? null
          }};
        }
        if (prev.triageActive) {
          const ta = prev.triageActive;
          // discharge
          if (u.ended_at) return { ...prev, triageActive: null, presence: { ...prev.presence, inTreatment: false } };
          if (isActive) {
            return { ...prev, triageActive: { ...ta, ...u } };
          }
        }
        return prev;
      });
    };
    socket.on("presence:update", onPresence);
    socket.on("triage:update", onTriage);
    return () => {
      socket.off("presence:update", onPresence);
      socket.off("triage:update", onTriage);
    };
  }, [crewId]);

  const vitalsNow = useMemo(() => overview?.vitalsNow ?? {}, [overview]);
  const identity  = useMemo(() => overview?.identity ?? null, [overview]);
  const presence  = useMemo(() => overview?.presence ?? null, [overview]);
  const triage    = useMemo(() => overview?.triageActive ?? null, [overview]);
  const orders    = useMemo(() => overview?.ordersActive ?? [], [overview]);

  return { loading, error, identity, presence, vitalsNow, series, triage, orders, refresh: () => {
    // optional reloader
    if (!crewId) return;
    fetch(`/api/crew/${crewId}/overview`).then(r=>r.json()).then(setOverview).catch(setError);
    fetch(`/api/crew/${crewId}/series?metrics=${METRICS}&window=${DEFAULT_WINDOW}&bucket=${DEFAULT_BUCKET}`)
      .then(r=>r.json()).then(setSeries).catch(setError);
  }};
}
