import './App.css'
import { useState, useMemo } from "react";
import LcarsSidebar from './components/LcarsSidebar';
import LcarsHeaderBar from './components/LcarsHeaderBar';
import MedicalTab from './components/MedicalTab';
import DashboardGrid from './components/DashboardGrid';
import { getTabTitle } from './components/TabRegistry';
import MissionOverview from './components/commandOps/missionOverview';

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const headerTitle = useMemo(() => getTabTitle(tab), [tab]);

  return (
    <div className="h-screen bg-black text-[rgb(var(--lcars-text))]">
      <div className="flex h-full min-h-0">
        <LcarsSidebar current={tab} onSelect={setTab} />
        <main className="flex-1 relative mr-6 flex flex-col min-h-0">
            <LcarsHeaderBar title={headerTitle}/>
            {tab === "dashboard" && <DashboardGrid />}
            {tab === "command_operations" && <MissionOverview />}
            {tab === "tactical_security" && (
              <div className="p-6 opacity-70">Tactical & Security — coming soon</div>
            )}
            {tab === "science_navigation" && (
              <div className="p-6 opacity-70">Science & Navigation — coming soon</div>
            )}
            {tab === "medical" && <MedicalTab />}
            {tab === "engineering_systems" && (
              <div className="p-6 opacity-70">Engineering & Ship Systems — coming soon</div>
            )}
            {tab === "logs" && (
              <div className="p-6 opacity-70">Logs — coming soon</div>
            )}
            {tab === "blueprint" && (
              <div className="p-6 opacity-70">Ship Blueprint — coming soon</div>
            )}
          </main>
      </div>
    </div>
  );
}
