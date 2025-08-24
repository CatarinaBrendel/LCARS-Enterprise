import Card from "../ui/Card";

export default function TreatmentOrders({ visits }) {
  const rows = visits
    .filter(v => ["admitted","under_treatment","recovering"].includes(v.state))
    .map(v => ({
      who: v.displayName || v.name || `#${v.crewId ?? v.crew_id}`,
      order:
        v.state === "recovering"      ? "MONITOR"   :
        v.state === "admitted"        ? "OBSERVE"   :
        (v.acuity ?? 3) >= 4          ? "IV FLUIDS" :
                                        "OXYGEN",
      state: v.state,
      acuity: v.acuity ?? 3,
      bed: v.bed ?? "—",
    }));
    

  return (
    <Card title="TREATMENT">
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center justify-between">
            <div className="w-40 font-extrabold tracking-wider text-zinc-200">{r.who}</div>
            <div className="flex-1 text-zinc-300">{r.order}</div>
          </li>
        ))}
        {rows.length === 0 && <li className="text-zinc-500 italic">No active orders.</li>}
      </ul>
    </Card>
  );
}
