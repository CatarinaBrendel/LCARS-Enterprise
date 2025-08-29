import React from "react";
import LcarsCard from "../LcarsCard.jsx";
import LcarsPillButton from "../LcarsPillButton.jsx";
import LcarsSubnav from "../LcarsSubnav.jsx";

function usePlaceholderSnapshot() {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((n) => (n + 1) % 1000000), 2500);
    return () => clearInterval(id);
  }, []);
  const baseTs = new Date().toISOString();
  return {
    data: {
      ts: baseTs,
      shields: { arcs: { fore: 92, aft: 88, port: 75, starboard: 80, dorsal: 67, ventral: 73 }, regenPctPerS: 1.2 + (tick % 3) * 0.05, coherence: 94 - (tick % 4) },
      lifeSupport: { o2Pct: 20.8, co2ppm: 540, tempC: 22.1 + (tick % 2), scrubberEffPct: 92, waterReclaimPct: 85 },
      transporter: { bufferIntegrity: 90 - (tick % 5), cycleHeatC: 65 + (tick % 7), alignment: 88, cooldownS: (tick % 2) ? 3 : 0 },
      consumables: { antimatterPct: 64, deuteriumPct: 73, coolantPct: 58, rcsPct: 61 },
      kpi: { powerReadiness: 84, thermalMarginC: 38, combatEnduranceMin: 12 + (tick % 3), systemsHealth: 86 },
      events: [
        { id: "s1", ts: baseTs, system: "shields", severity: "info", message: "Fore arc modulation retuned." },
        { id: "s2", ts: baseTs, system: "lifeSupport", severity: "warn", message: "CO₂ rising on Deck 7; scrubbers boosted." },
      ],
    },
    loading: false,
    error: null,
    refresh: () => setTick((n) => n + 1),
  };
}

export default function ShipSystemsTab() {
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
      <LcarsSubnav items={[{ key: "ship-systems", label: "Ship Systems", active: true }]} onSelect={() => {}} />

      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[rgb(var(--lcars-text))]">Ship Systems</h1>
          <p className="text-sm opacity-70">Snapshot: {new Date(data?.ts || Date.now()).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-3">
          {loading && <span className="text-sm opacity-70">Loading…</span>}
          {error && <span className="text-sm text-red-400">{String(error)}</span>}
          <LcarsPillButton color="gold" onClick={refresh}>Refresh</LcarsPillButton>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Defenses */}
        <LcarsCard className="lg:col-span-7">
          <Title>Shields</Title>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="Fore" value={data?.shields?.arcs?.fore} unit="%" />
            <Stat label="Aft" value={data?.shields?.arcs?.aft} unit="%" />
            <Stat label="Port" value={data?.shields?.arcs?.port} unit="%" />
            <Stat label="Starboard" value={data?.shields?.arcs?.starboard} unit="%" />
            <Stat label="Dorsal" value={data?.shields?.arcs?.dorsal} unit="%" />
            <Stat label="Ventral" value={data?.shields?.arcs?.ventral} unit="%" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Regen" value={data?.shields?.regenPctPerS} unit="%/s" />
            <Stat label="Coherence" value={data?.shields?.coherence} unit="/100" />
          </div>
        </LcarsCard>

        {/* Environmentals */}
        <LcarsCard className="lg:col-span-5">
          <Title>Life Support</Title>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="O₂" value={data?.lifeSupport?.o2Pct} unit="%" />
            <Stat label="CO₂" value={data?.lifeSupport?.co2ppm} unit="ppm" />
            <Stat label="Temp" value={data?.lifeSupport?.tempC} unit="°C" />
            <Stat label="Scrubbers" value={data?.lifeSupport?.scrubberEffPct} unit="%" />
          </div>
        </LcarsCard>

        {/* Transporters */}
        <LcarsCard className="lg:col-span-5">
          <Title>Transporters</Title>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Buffer" value={data?.transporter?.bufferIntegrity} unit="/100" />
            <Stat label="Alignment" value={data?.transporter?.alignment} unit="/100" />
            <Stat label="Cycle Heat" value={data?.transporter?.cycleHeatC} unit="°C" />
            <Stat label="Cooldown" value={data?.transporter?.cooldownS} unit="s" />
          </div>
        </LcarsCard>

        {/* Supplies */}
        <LcarsCard className="lg:col-span-4">
          <Title>Consumables</Title>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Antimatter" value={data?.consumables?.antimatterPct} unit="%" />
            <Stat label="Deuterium" value={data?.consumables?.deuteriumPct} unit="%" />
            <Stat label="Coolant" value={data?.consumables?.coolantPct} unit="%" />
            <Stat label="RCS" value={data?.consumables?.rcsPct} unit="%" />
          </div>
        </LcarsCard>

        {/* KPIs */}
        <LcarsCard className="lg:col-span-3">
          <Title>KPIs</Title>
          <div className="mt-3 grid grid-cols-1 gap-3">
            <Stat label="Power Readiness" value={data?.kpi?.powerReadiness} unit="/100" />
            <Stat label="Thermal Margin" value={data?.kpi?.thermalMarginC} unit="°C" />
            <Stat label="Combat Endurance" value={data?.kpi?.combatEnduranceMin} unit="min" />
            <Stat label="Systems Health" value={data?.kpi?.systemsHealth} unit="/100" />
          </div>
        </LcarsCard>

        {/* Events */}
        <LcarsCard className="lg:col-span-12">
          <Title>Events</Title>
          <ul className="mt-3 space-y-1 text-sm">
            {(data?.events || []).map((e) => (
              <li key={e.id} className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs">{e.severity}</span>
                <span className="opacity-70">[{new Date(e.ts).toLocaleTimeString()}]</span>
                <span className="uppercase tracking-wide text-xs opacity-60">{e.system}</span>
                <span>— {e.message}</span>
              </li>
            ))}
            {(!data?.events || data.events.length === 0) && (
              <li className="opacity-70">No events yet.</li>
            )}
          </ul>
        </LcarsCard>
      </div>
    </div>
  );
}
