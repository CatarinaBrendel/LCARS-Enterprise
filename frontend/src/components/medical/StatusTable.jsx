import useCrewStatsLive from "../../hooks/useCrewStatsLive";

function cellTone(metric, v) {
  if (v == null) return "bg-black/40";
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
  return "bg-black/40";
}

function MetricCell({ metric, r, unit }) {
  const v = r[metric];
  const trend = r[`${metric}_trend`]; // "up" | "down" | "flat"
  const changedAt = r[`${metric}_changed_at`] || 0;
  const recentlyChanged = Date.now() - changedAt < 1200;

  return (
    <td className={`p-2 text-right tabular-nums rounded-md ${cellTone(metric, v)} ${recentlyChanged ? "flash-once" : ""}`}>
      <div className="inline-flex items-center gap-2">
        <span className="font-semibold">{v ?? "—"}</span>
        <span className="text-xs opacity-70">{unit}</span>
        <span className={`text-xs ${trend === "up" ? "text-[rgb(var(--lcars-amber))]" : trend === "down" ? "text-[rgb(var(--lcars-red))]" : "opacity-50"}`}>
          {trend === "up" ? "▲" : trend === "down" ? "▼" : "■"}
        </span>
      </div>
    </td>
  );
}

export default function StatusTable() {
  const { rows, loading } = useCrewStatsLive();

  return (
    <div className="rounded-3xl overflow-hidden bg-black border-4 border-[rgb(var(--lcars-amber))]">
      <div className="bg-[rgb(var(--lcars-amber))] text-black font-bold text-xl px-4 py-2">
        CREW STATUS
      </div>

      <div className="h-[60vh] overflow-auto">
        <table className="w-full h-full border-collapse text-lg">
          <thead>
            <tr className="bg-black/60 text-[rgb(var(--lcars-amber))] text-sm uppercase">
              <th className="p-2 text-left">Crew</th>
              <th className="p-2 text-center">Heart Rate</th>
              <th className="p-2 text-center">O₂ Sat</th>
              <th className="p-2 text-center">Core Temp</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" className="p-6 text-center opacity-70">Loading crew stats…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="4" className="p-6 text-center opacity-70">No data.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.crewId} className="bg-black/40 border-t border-black/70">
                <td className="p-2 font-semibold text-[rgb(var(--lcars-amber))]">
                  {r.name ?? `#${r.crewId}`}
                </td>
                <MetricCell metric="heart_rate" r={r} unit="bpm" />
                <MetricCell metric="o2_sat"     r={r} unit="%" />
                <MetricCell metric="body_temp"  r={r} unit="°C" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
