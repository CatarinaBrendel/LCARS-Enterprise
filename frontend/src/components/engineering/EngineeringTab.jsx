import React from "react";
import LcarsCard from "../LcarsCard.jsx";
import LcarsPillButton from "../LcarsPillButton.jsx";
// Later: replace with `import { useEngineeringSnapshot } from "../../hooks/useEngineeringSnapshot";`

function usePlaceholderSnapshot() {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((n) => (n + 1) % 1000000), 2000);
    return () => clearInterval(id);
  }, []);
  const baseTs = new Date().toISOString();
  return {
    data: {
      ts: baseTs,
      warpCore: { outputMW: 1230 + (tick % 40), maxOutputMW: 3000, stability: 87, intermix: 1.01, plasmaTempK: 1400, latticeStress: 22 },
      eps: { gridLoadPct: 78, lineLossPct: 3.4, tripsPerMin: tick % 3, sections: [{ id: "A1", tempC: 62, loadPct: 71 }] },
      sif: { strength: 88, hullStressMpa: 3.2, emitterHealthPct: 96 },
      impulse: { reactorPct: 34, thrustVector: 98, rcsFuelPct: 61, nozzleTempC: 430 },
      damage: { activeFaults: tick % 2, openWorkOrders: 2, teamsActive: 1, etaMin: 14 },
    },
    loading: false,
    error: null,
    refresh: () => setTick((n) => n + 1),
  };
}

export default function EngineeringTab() {
  const { data, loading, error, refresh } = usePlaceholderSnapshot();

  const Title = ({ children }) => (
    <h3 className="text-lg font-semibold tracking-wide text-[rgb(var(--lcars-text))]">{children}</h3>
  );

  const Stat = ({ label, value, unit }) => (
    <div className="flex items-baseline gap-2">
      <span className="text-sm opacity-70">{label}</span>
      <span className="text-2xl tabular-nums">{value ?? "—"}</span>
      {unit && <span className="text-xs opacity-70">{unit}</span>}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[rgb(var(--lcars-text))]">Engineering</h1>
          <p className="text-sm opacity-70">Snapshot: {new Date(data?.ts || Date.now()).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-3">
          {loading && <span className="text-sm opacity-70">Loading…</span>}
          {error && <span className="text-sm text-red-400">{String(error)}</span>}
          <LcarsPillButton color="gold" onClick={refresh}>Refresh</LcarsPillButton>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Core power */}
        <LcarsCard className="lg:col-span-5">
          <Title>Warp Core</Title>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Output" value={Math.round(data?.warpCore?.outputMW)} unit="MW" />
            <Stat label="Max" value={data?.warpCore?.maxOutputMW} unit="MW" />
            <Stat label="Stability" value={data?.warpCore?.stability} unit="/100" />
            <Stat label="Intermix" value={data?.warpCore?.intermix?.toFixed?.(2)} />
            <Stat label="Plasma Temp" value={data?.warpCore?.plasmaTempK} unit="K" />
            <Stat label="Lattice Stress" value={data?.warpCore?.latticeStress} unit="%" />
          </div>
        </LcarsCard>

        {/* EPS distribution */}
        <LcarsCard className="lg:col-span-7">
          <Title>EPS Grid</Title>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="Load" value={data?.eps?.gridLoadPct} unit="%" />
            <Stat label="Line Losses" value={data?.eps?.lineLossPct} unit="%" />
            <Stat label="Breaker Trips" value={data?.eps?.tripsPerMin} unit="/min" />
          </div>
          <div className="mt-4 h-3 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-[70%] bg-[rgb(var(--lcars-amber))]" />
          </div>
        </LcarsCard>

        {/* Structure */}
        <LcarsCard className="lg:col-span-7">
          <Title>Structural Integrity Field</Title>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="Field Strength" value={data?.sif?.strength} unit="/100" />
            <Stat label="Hull Stress" value={data?.sif?.hullStressMpa} unit="MPa" />
            <Stat label="Emitter Health" value={data?.sif?.emitterHealthPct} unit="%" />
          </div>
        </LcarsCard>

        {/* Propulsion */}
        <LcarsCard className="lg:col-span-5">
          <Title>Impulse / RCS</Title>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Impulse" value={data?.impulse?.reactorPct} unit="%" />
            <Stat label="RCS Fuel" value={data?.impulse?.rcsFuelPct} unit="%" />
            <Stat label="Nozzle Temp" value={data?.impulse?.nozzleTempC} unit="°C" />
            <Stat label="Vector Integrity" value={data?.impulse?.thrustVector} unit="/100" />
          </div>
        </LcarsCard>

        {/* Damage control */}
        <LcarsCard className="lg:col-span-12">
          <Title>Damage Control</Title>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Active Faults" value={data?.damage?.activeFaults} />
            <Stat label="Work Orders" value={data?.damage?.openWorkOrders} />
            <Stat label="Teams Active" value={data?.damage?.teamsActive} />
            <Stat label="ETA" value={data?.damage?.etaMin} unit="min" />
          </div>
        </LcarsCard>
      </div>
    </div>
  );
}
