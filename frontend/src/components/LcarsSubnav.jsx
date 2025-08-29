export default function LcarsSubnav({ value, onChange, items = [
  { id: "status", label: "STATUS" },
  { id: "presence", label: "PRESENCE" },
  { id: "triage", label: "TRIAGE" },
]}) {
  return (
    <nav className="flex gap-2">
      {items.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-3 py-1 rounded-md font-bold tracking-widest ${
            value === t.id
              ? "bg-[rgb(var(--lcars-amber))] text-black"
              : "bg-black/50 text-[rgb(var(--lcars-amber))] border border-[rgb(var(--lcars-amber))]/40"
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
