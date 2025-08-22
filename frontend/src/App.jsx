import './App.css'
import CrewStatus from './components/CrewStatus'
import { useState } from "react";
import LcarsSidebar from "./components/LcarsSidebar";
import LcarsHeaderBar from "./components/LcarsHeaderBar";
import EnterpriseMap from "./assets/sovereign2.jpg";
import MedicalTab from './components/MedicalTab';
import DashboardGrid from './components/DashboardGrid';

export default function App() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="min-h-screen bg-black text-[rgb(var(--lcars-text))]">
      <div className="flex">
        <LcarsSidebar current={tab} onSelect={setTab} />
        <main className="flex-1 relative">
            <LcarsHeaderBar />

            {tab === "network" && (
              <img
                src={EnterpriseMap}
                alt="Ship Blueprint"
                className="absolute inset-0 w-full h-auto object-cover"
                draggable={false}
              />
            )}

            {tab === "dashboard" && <DashboardGrid />}

            {tab === "medical" && <MedicalTab />}

            {tab === "systems" && (
              <div className="p-6 opacity-70">Ship Systems — coming soon</div>
            )}

            {tab === "logs" && (
              <div className="p-6 opacity-70">Logs — coming soon</div>
            )}
          </main>
      </div>
    </div>
  );
}
