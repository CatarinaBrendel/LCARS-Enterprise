export default function LcarsPillButton({
  children,
  color = "gold",
  isActive = false,
  className = "",
  ...props
}) {
  return (
    <button
      {...props}
      className={`w-full text-left px-5 py-4 rounded-lcars uppercase font-semibold tracking-wider
        bg-lcars-${color} text-black
        hover:brightness-110 active:scale-[.98] transition
        ${isActive ? "ring-2 ring-black/40" : ""}
        ${className}`}
    >
      {children}
    </button>
  );
}
