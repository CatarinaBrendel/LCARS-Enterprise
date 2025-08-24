import { useState } from "react";
import LcarsSubnav from "./LcarsSubnav";
import CrewPresenceView from "./CrewPresenceView";
import StatusTable from "./medical/StatusTable";
import TriageOverview from "./medical/TriageOverview";
import CrewDrawer from './crew/CrewDrawer';

export default function MedicalTab() {
  const [subTab, setSubTab] = useState("status");
  const [drawerId, setDrawerId] = useState(null);

  const items = [
    { id: "status",   label: "STATUS" },
    { id: "presence", label: "PRESENCE" },
    { id: "triage",   label: "TRIAGE" },
  ];

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-widest text-[#f2a007]">Medical</h2>
        <LcarsSubnav value={subTab} onChange={setSubTab} items={items} />
      </div>

      {subTab === "status"   && <StatusTable onSelectCrew={(id) => setDrawerId(id)} />}
      {subTab === "presence" && <CrewPresenceView onSelectCrew={(id) => setDrawerId(id)} />}
      {subTab === "triage"   && <TriageOverview />}

      {drawerId && <CrewDrawer crewId={drawerId} onClose={() => setDrawerId(null)}/>}
    </div>
  );
}
