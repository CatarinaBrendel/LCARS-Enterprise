import React from "react";
import useCrewStatsLive from "../hooks/useCrewStatsLive";

// simple color feedback
function cellTone(metric, v) {
  if (v == null) return "bg-[rgb(var(--lcars-slate))]/30";
  if (metric === "o2_sat")   return v >= 95 ? "bg-[rgb(var(--lcars-blue))]/25"  : v >= 90 ? "bg-[rgb(var(--lcars-amber))]/30" : "bg-[rgb(var(--lcars-red))]/30";
  if (metric === "heart_rate") {
    if (v >= 50 && v <= 110) return "bg-[rgb(var(--lcars-blue))]/25";
    if ((v > 110 && v <= 130) || (v >= 40 && v < 50)) return "bg-[rgb(var(--lcars-amber))]/30";
    return "bg-[rgb(var(--lcars-red))]/30";
  }
  if (metric === "body_temp") {
    if (v >= 36 && v <= 38)  return "bg-[rgb(var(--lcars-blue))]/25";
    if ((v > 38 && v <= 39) || (v >= 35 && v < 36)) return "bg-[rgb(var(--lcars-amber))]/30";
    return "bg-[rgb(var(--lcars-red))]/30";
  }
  return "bg-[rgb(var(--lcars-slate))]/30";
}

export default function MedicalTab() {
  const { rows, loading } = useCrewStatsLive();

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-2xl px-4 py-3 bg-[rgb(var(--lcars-amber))] text-black text-2xl font-bold">
        MEDICAL — Crew Status
      </div>

      <div className="rounded-3xl p-3 bg-black/40 border border-[rgb(var(--lcars-amber))]/60">
        <table className="w-full text-sm">
          <thead className="bg-black/30">
            <tr>
              <th className="text-left p-2 rounded-l-xl">Crew</th>
              <th className="text-right p-2">Heart Rate</th>
              <th className="text-right p-2">O₂ Sat</th>
              <th className="text-right p-2 rounded-r-xl">Body Temp</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" className="p-6 text-center opacity-70">Loading crew stats…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="4" className="p-6 text-center opacity-70">No data.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.crewId} className={i % 2 ? "bg-black/20" : ""}>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-10 rounded-full bg-[rgb(var(--lcars-copper))]" />
                    <div className="font-medium">{r.name ?? `#${r.crewId}`}</div>
                    <div className="text-xs opacity-60">#{r.crewId}</div>
                  </div>
                </td>
                <td className={`p-2 text-right tabular-nums rounded-md ${cellTone("heart_rate", r.heart_rate)}`}>
                  {r.heart_rate ?? "—"} <span className="text-xs opacity-70">bpm</span>
                </td>
                <td className={`p-2 text-right tabular-nums rounded-md ${cellTone("o2_sat", r.o2_sat)}`}>
                  {r.o2_sat ?? "—"} <span className="text-xs opacity-70">%</span>
                </td>
                <td className={`p-2 text-right tabular-nums rounded-md ${cellTone("temp_core", r.body_temp)}`}>
                  {r.body_temp ?? "—"} <span className="text-xs opacity-70">°C</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
