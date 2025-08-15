export default function LcarsButton({
  children,
  color = "gold", // lcars-amber, lcars-red, lcars-blue, etc.
  onClick,
  className = "",
}) {

  return (
    <button
      onClick={onClick}
      className={`
        rounded-lcars px-4 py-2 font-semibold tracking-wider uppercase
        bg-lcars-${color} text-black
        hover:brightness-110 active:scale-95 transition
        ${className}
      `}
    >
      {children}
    </button>
  );
}
