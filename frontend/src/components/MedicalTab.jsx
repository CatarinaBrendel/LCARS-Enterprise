import { useState } from "react";
import LcarsSubnav from "./LcarsSubnav";
import CrewPresenceView from "./CrewPresenceView";
import StatusTable from "./medical/StatusTable";
import TriageOverview from "./medical/TriageOverview";

export default function MedicalTab() {
  const [subTab, setSubTab] = useState("status");

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

      {subTab === "status"   && <StatusTable />}
      {subTab === "presence" && <CrewPresenceView />}
      {subTab === "triage"   && <TriageOverview />}
    </div>
  );
}
