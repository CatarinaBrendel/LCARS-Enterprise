export default function StatusButtons({ status, onChange, pending }) {
  const actions = [
    { label: 'Resume',   to: 'in_progress', color: 'bg-lcars-blue'  },
    { label: 'Hold',     to: 'hold',        color: 'bg-lcars-slate' },
    { label: 'Complete', to: 'completed',   color: 'bg-lcars-gold'  },
    { label: 'Abort',    to: 'aborted',     color: 'bg-lcars-red'   },
  ];
  return (
    <div className="flex gap-2">
      {actions.map(({ label, to, color }) => {
        const isActive = status === to;
        const disabled = pending || isActive;
        return (
          <button
            key={to}
            onClick={() => onChange(to)}
            disabled={disabled}
            aria-pressed={isActive}
            title={isActive ? `Already ${label.toLowerCase()}` : label}
            className={[
              "px-3 py-1 rounded text-black/90 transition-opacity focus:outline-none focus:ring-2 focus:ring-black/40",
              disabled ? "opacity-50 cursor-default" : `${color} hover:opacity-90`,
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}