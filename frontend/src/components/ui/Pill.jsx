export default function Pill({ children, tone = "default", className = "" }) {
  const tones = {
    default: "bg-zinc-700/80 text-zinc-200",
    good: "bg-[#18c56e] text-black",
    warn: "bg-[rgb(var(--lcars-amber))] text-black",
    bad: "bg-[#f75b4f] text-black",
    info: "bg-[rgb(var(--lcars-blue))]/25 text-[rgb(var(--lcars-amber))]",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tones[tone]} ${className}`}>{children}</span>;
}
