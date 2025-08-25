import Card from "../ui/Card";
import useTriage from "../../hooks/useTriage";
import TriageList from "./TriageList";
import TreatmentOrders from "./TreatmentOrders";

export default function TriageOverview({onSelectCrew}) {
  const { grouped, visits, loading } = useTriage();

  if (loading) return <div className="p-6 text-zinc-400">Loading Sickbay…</div>;

  // central list (prioritize patients in triage/under_treatment like your mock)
  const display = [
    ...grouped.under_treatment,
    ...grouped.admitted,
    ...grouped.triage,
    ...grouped.recovering,
    ...grouped.queued
  ];

  // Resolve crew id robustly from a visit object
  const handleOpenCrew = (vOrId) => {
    const cid = typeof vOrId === 'number'
      ? vOrId
      : (vOrId?.crew_id ?? vOrId?.crewId ?? vOrId?.crew?.id);
    if (cid) onSelectCrew?.(cid);
    console.log("Hello, open ", cid);
  };

  return (
    <div className="grid grid-cols-12 gap-6 p-6">{/* Center: Triage list */}
      <div className="col-span-6">
        <Card>
          <TriageList visits={display} onSelectCrew={handleOpenCrew} />
        </Card>
      </div>

      {/* Right: Treatment orders */}
      <div className="col-span-6">
        <TreatmentOrders visits={visits}  onSelectCrew={handleOpenCrew}/>
      </div>
    </div>
  );
}
