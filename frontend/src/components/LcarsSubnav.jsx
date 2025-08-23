export default function LcarsSubnav({ value, onChange }) {
  const Item = ({ id, label }) => (
    <button
      onClick={() => onChange(id)}
      className={[
        'px-4 py-2 rounded-l-full rounded-r-full uppercase tracking-wider text-sm font-semibold',
        value === id
          ? 'bg-[#f2a007] text-black shadow-md'
          : 'bg-[#2a2a2a] text-[#f2a007] hover:bg-[#3a3a3a]'
      ].join(' ')}
      aria-pressed={value === id}
    >
      {label}
    </button>
  );
  return (
    <div className="flex gap-2 items-center">
      <Item id="status"   label="Crew Status" />
      <Item id="presence" label="Crew Presence" />
    </div>
  );
}
