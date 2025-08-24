import useCrewOverview from "../../hooks/useCrewOverview";
import Sparkline from "../ui/Sparkline";
import Pill from "../ui/Pill";
import HistorySection from "./HistorySection";

export default function CrewDrawer({ crewId, onClose }) {
  const { loading, error, identity, presence, vitalsNow, series, triage, orders } = useCrewOverview(crewId);
  if (!crewId) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-[640px] bg-black border-l-4 border-[rgb(var(--lcars-amber))] shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="bg-[rgb(var(--lcars-amber))] text-black px-4 py-3 flex items-center justify-between">
          <div className="font-extrabold tracking-widest">
            {identity ? `${identity.name}  •  C-${identity.crewId}` : "Loading…"}
            <div className="text-xs font-semibold opacity-80">{identity?.role}</div>
          </div>
          <button onClick={onClose} className="px-3 py-1 rounded-md font-bold bg-black/10 hover:bg-black/20">×</button>
        </div>

        {/* Status chips */}
        <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-zinc-800">
          {presence && (
            <>
              <Pill tone={presence.onDuty ? "info" : "default"}>{presence.onDuty ? "ON DUTY" : "OFF DUTY"}</Pill>
              {presence.inTreatment ? <Pill tone="bad">IN TREATMENT</Pill> : (
                <Pill tone={presence.busy ? "warn" : "default"}>{presence.busy ? "BUSY" : "IDLE"}</Pill>
              )}
              <Pill className="!bg-zinc-800 !text-zinc-200">{presence.deck_zone || "—"}</Pill>
            </>
          )}
        </div>

        {/* Body */}
        <div className="p-4 space-y-6">
          {/* Vitals Now */}
          <section className="bg-black/40 border border-zinc-800 rounded-xl p-3">
            <div className="text-[rgb(var(--lcars-amber))] font-extrabold tracking-widest mb-2">VITALS — NOW (2h)</div>
            <Row label="Heart Rate" value={fmt(vitalsNow.heart_rate, "bpm")} spark={<Sparkline data={series.heart_rate} />} />
            <Row label="O₂ Saturation" value={fmt(vitalsNow.o2_sat, "%")} spark={<Sparkline data={series.o2_sat} />} />
            <Row label="Core Temp" value={fmt(vitalsNow.body_temp, "°C")} spark={<Sparkline data={series.body_temp} />} />
            {vitalsNow.bp != null && <Row label="BP" value={String(vitalsNow.bp)} />}
          </section>

          {/* Triage */}
          <section className="bg-black/40 border border-zinc-800 rounded-xl p-3">
            <div className="text-[rgb(var(--lcars-amber))] font-extrabold tracking-widest mb-2">TRIAGE</div>
            {triage ? (
              <div className="space-y-2">
                <KV k="State" v={triage.state?.replace("_", " ").toUpperCase()} />
                <KV k="Acuity" v={triage.acuity != null ? String(triage.acuity) : "—"} />
                <KV k="Complaint" v={triage.complaint || "—"} />
                <div className="flex gap-3">
                  <KV k="Bed" v={triage.bed || "—"} />
                  <KV k="Assigned to" v={triage.assigned_to || "—"} />
                </div>
                {triage.timeline && !!triage.timeline.length && (
                  <div className="mt-2">
                    <div className="text-xs uppercase text-zinc-400 mb-1">Timeline</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {triage.timeline.map((t,i)=>(
                        <span key={i} className="text-xs text-zinc-300">{dot(i)} {t.state.replace("_"," ")} <span className="opacity-50">({shortTime(t.at)})</span></span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-zinc-400 italic">No active triage visit.</div>
            )}
          </section>

          {/* Orders */}
          <section className="bg-black/40 border border-zinc-800 rounded-xl p-3">
            <div className="text-[rgb(var(--lcars-amber))] font-extrabold tracking-widest mb-2">ORDERS</div>
            {(!orders || orders.length === 0) ? (
              <div className="text-zinc-400 italic">No active orders.</div>
            ) : (
              <ul className="space-y-2">
                {orders.map(o => (
                  <li key={o.id} className="flex items-center justify-between">
                    <div className="text-zinc-200 truncate">{o.label || o.kind}</div>
                    <Pill tone={o.status === "running" ? "warn" : o.status === "active" ? "info" : "default"}>
                      {o.status.toUpperCase()}
                    </Pill>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {error && <div className="text-red-400 text-sm">Error: {String(error.message || error)}</div>}
          {loading && <div className="text-zinc-400 text-sm">Loading…</div>}
        </div>

        {/* History */}
          <HistorySection crewId={crewId} />
      </aside>
    </div>
  );
}

function Row({ label, value, spark }) {
  return (
    <div className="flex items-center justify-between py-2 border-t border-zinc-800 first:border-t-0">
      <div className="text-zinc-400 text-sm">{label}</div>
      <div className="flex items-center gap-8">
        {spark}
        <div className="font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}
function KV({ k, v }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase text-zinc-400">{k}</span>
      <span className="text-zinc-200">{v}</span>
    </div>
  );
}
const fmt = (v, unit) => (v == null ? "—" : `${v}${unit ? " " + unit : ""}`);
const dot = (i) => i === 0 ? "●" : "○";
const shortTime = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
