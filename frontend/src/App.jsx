// App.jsx
import './App.css'
import { useState, useMemo } from "react";
import LcarsHeaderBar from './components/LcarsHeaderBar';
import MedicalTab from './components/MedicalTab';
import DashboardGrid from './components/DashboardGrid';
import { getTabTitle } from './components/TabRegistry';
import MissionOverview from './components/commandOps/missionOverview';
import LcarsSidebar from './components/LcarsSidebar';
import EngineeringSystemsTab from './components/engineering/EngineeringSystemsTab';

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const headerTitle = useMemo(() => getTabTitle(tab), [tab]);

  return (
    <div className="h-dvh bg-black text-[rgb(var(--lcars-text))] grid grid-rows-[auto,1fr,auto] overflow-hidden">
      {/* Header row */}
      <LcarsHeaderBar title={headerTitle} />

      {/* Main content row */}
      <main className="px-6 pb-4 overflow-y-auto min-h-0">
        {tab === "dashboard" && <DashboardGrid />}
        {tab === "command_operations" && <MissionOverview />}
        {tab === "tactical_security" && (
          <div className="p-6 opacity-70">Tactical & Security — coming soon</div>
        )}
        {tab === "science_navigation" && (
          <div className="p-6 opacity-70">Science & Navigation — coming soon</div>
        )}
        {tab === "medical" && <MedicalTab />}
        {tab === "engineering_systems" && <EngineeringSystemsTab />}
        {tab === "logs" && <div className="p-6 opacity-70">Logs — coming soon</div>}
        {tab === "blueprint" && (
          <div className="p-6 opacity-70">Ship Blueprint — coming soon</div>
        )}
      </main>

      {/* Footer nav row */}
      <LcarsSidebar current={tab} onSelect={setTab} />
    </div>
  );
}
