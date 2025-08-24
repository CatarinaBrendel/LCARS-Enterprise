import { useEffect, useMemo, useRef, useState } from "react";
import io from "socket.io-client";

const toDisplayName = (v) => {
  const surname =
    v.surname ?? v.last_name ?? v.lastName ?? v.family_name ?? v.crew?.surname ?? v.crew?.last_name;
  const given =
    v.given_name ?? v.first_name ?? v.firstName ?? v.name ?? v.crew?.first_name ?? v.crew?.name;

  if (surname && given)      return `${surname}, ${given}`;
  if (surname)               return surname;
  if (given)                 return given;

  // Fallback to joined full name; split if possible
  const full = v.crew_name ?? v.crewName ?? v.name ?? v.crew?.name;
  if (typeof full === "string" && full.trim()) {
    const parts = full.trim().split(/\s+/);
    if (parts.length >= 2)  return `${parts.slice(-1)[0]}, ${parts.slice(0, -1).join(" ")}`;
    return full;
  }

  // Last resort: id placeholder
  const cid = v.crewId ?? v.crew_id ?? v.crew?.id;
  return cid ? `#${cid}` : "—";
};

const normalize = (v) => ({
  ...v,
  crewId: v.crewId ?? v.crew_id ?? v.crew?.id,
  displayName: toDisplayName(v),
});

export default function useTriage() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  // seed
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/triage/visits");
        const data = await res.json();
        if (alive) setVisits((data || []).map(normalize));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // live updates
  useEffect(() => {
    const s = io("/", { transports: ["websocket"] });
    socketRef.current = s;
    s.on("triage:update", (u) => {
      const upd = normalize(u);
      setVisits((prev) => {
        const i = prev.findIndex(v => v.id === upd.id);
        if (i === -1) return [...prev, upd].filter(v => !v.ended_at);
        const next = [...prev];
        next[i] = { ...prev[i], ...upd, displayName: upd.displayName || prev[i].displayName };
        return next.filter(v => !v.ended_at);
      });
    });
    return () => { s.close(); };
  }, []);

  const grouped = useMemo(() => {
    const g = { queued:[], triage:[], admitted:[], under_treatment:[], recovering:[] };
    for (const v of visits) { if (g[v.state]) g[v.state].push(v); }
    for (const k of Object.keys(g)) g[k].sort((a,b)=> (a.acuity??3)-(b.acuity??3));
    return g;
  }, [visits]);

  return { visits, grouped, loading };
}
