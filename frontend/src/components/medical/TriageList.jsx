import EcgMini from "../ui/ECGmini";
import StatusPill from "../ui/StatusPill";

const acuityToPill = (acuity) => {
  // 1=low → 5=high (tune copy/colors to taste)
  switch (acuity) {
    case 1: return { text: "GOOD", tone: "good" };
    case 2: return { text: "FAIR", tone: "default" };
    case 3: return { text: "GUARD", tone: "default" };
    case 4: return { text: "SERIOUS", tone: "muted" };
    case 5: return { text: "CRITICAL", tone: "bad" };
    default: return { text: "STABLE", tone: "default" };
  }
};

export default function TriageList({ visits }) {
  return (
    <div>
      <div className="text-lcars-amber text-xl font-extrabold tracking-widest mb-2">TRIAGE</div>
      <div className="divide-y divide-zinc-800">
        {visits.map(v => {
          const pill = acuityToPill(v.acuity);

          return (
            <div key={v.id} className="flex items-center justify-between py-3">
              <div className="w-40 truncate text-zinc-300 font-extrabold tracking-wider">
                {v.displayName}
              </div>
              <div className="flex-1"><EcgMini ok={v.acuity <= 3} /></div>
              <div className="w-36 text-right">
                <StatusPill tone={pill.tone}>{pill.text}</StatusPill>
              </div>
            </div>
          );
        })}
        {visits.length === 0 && (
          <div className="py-6 text-zinc-500 italic">No active patients.</div>
        )}
      </div>
    </div>
  );
}
