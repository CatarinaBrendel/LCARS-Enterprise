export default function LcarsMeter({ value = 0, max = 100, color = "gold" }) {
  const pct = Math.min(Math.max(value / max * 100, 0), 100);
  return (
    <div className="w-full h-3 rounded-lcars bg-lcars-brown/60 overflow-hidden">
      <div className={`h-full bg-lcars-${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
