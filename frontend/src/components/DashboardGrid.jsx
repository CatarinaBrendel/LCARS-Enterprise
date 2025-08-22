import React from "react";
import LcarsCard from "./LcarsCard";
import LcarsMeter from "./LcarsMeter";

export default function DashboardGrid() {
  return (
    <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <LcarsCard title="Impulse Engines">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between"><span>Power</span><span>72%</span></div>
          <LcarsMeter value={72} />
          <div className="flex items-center justify-between"><span>Coil Temp</span><span>700°</span></div>
          <LcarsMeter value={70} color="copper" />
          <div className="flex items-center justify-between"><span>Efficiency</span><span>82%</span></div>
          <LcarsMeter value={82} color="gold" />
        </div>
      </LcarsCard>

      <LcarsCard title="Red Alert">
        <div className="space-y-3">
          <div className="h-10 rounded-lcars bg-lcars-red flex items-center justify-center text-black font-bold">
            RED ALERT
          </div>
          <div className="flex gap-2">
            <div className="h-3 flex-1 bg-lcars-red/60 rounded-lcars" />
            <div className="h-3 flex-1 bg-lcars-red/60 rounded-lcars" />
          </div>
        </div>
      </LcarsCard>

      <LcarsCard title="Shields">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between"><span>Fore</span><span>88%</span></div>
          <LcarsMeter value={88} color="gold" />
          <div className="flex items-center justify-between"><span>Aft</span><span>88%</span></div>
          <LcarsMeter value={88} color="gold" />
          <div className="flex items-center justify-between"><span>Port</span><span>70%</span></div>
          <LcarsMeter value={70} color="amber" />
        </div>
      </LcarsCard>

      <LcarsCard title="Deflector">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between"><span>Field Strength</span><span>84%</span></div>
          <LcarsMeter value={84} color="blue" />
          <div className="flex items-center justify-between"><span>Resonance</span><span>6.0 Hz</span></div>
          <LcarsMeter value={60} color="blue" />
        </div>
      </LcarsCard>

      <LcarsCard title="Torpedoes">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between"><span>Load</span><span>0.8</span></div>
          <LcarsMeter value={80} color="copper" />
          <div className="flex items-center justify-between"><span>Subspace Contacts</span><span>2</span></div>
          <LcarsMeter value={20} color="slate" />
        </div>
      </LcarsCard>
    </div>
  );
}
