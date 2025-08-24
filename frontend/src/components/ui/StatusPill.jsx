export default function StatusPill({ tone="default", children }) {
  const tones = {
    default: "bg-lcars-amber/90 text-black",
    good: "bg-green-800/80 text-[rgb(var(--lcars-text))]",
    warn: "bg-orange-600/90 text-black",
    bad: "bg-red-700/90 text-[rgb(var(--lcars-text))]",
    muted: "bg-zinc-700/80 text-zinc-200",
  };
  return (
    <span className={`px-3 py-1 rounded-md tracking-wider text-sm font-black ${tones[tone]}`}>
      {children}
    </span>
  );
}
