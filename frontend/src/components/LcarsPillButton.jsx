// components/LcarsPillButton.jsx
export default function LcarsPillButton({
  children,
  color = "gold",          // hue only used for the active baton
  isActive = false,
  className = "",
  ...props
}) {
  const accent = `bg-lcars-${color}-dark`; // thin baton color when active

  return (
    <button
      {...props}
      aria-current={isActive ? "page" : undefined}
      className={[
        "relative w-full h-10 px-2 rounded-lcars",
        "flex items-center justify-center text-center",
        "font-semibold leading-none",
        // ✨ transparent pill: no colored background
        "bg-transparent text-[rgb(var(--lcars-text))]",
        // gentle hover/focus
        "hover:bg-white/5 transition focus:outline-none focus:ring-2 focus:ring-black/40",
        // dim inactive labels slightly
        isActive ? "opacity-100" : "opacity-70",
        className,
      ].join(" ")}
    >
      {/* subtle LCARS accent baton on active */}
      {isActive && (
        <span
          aria-hidden="true"
          className={`absolute left-0 top-0 h-full w-1.5 rounded-l-full ${accent}`}
        />
      )}
      {children}
    </button>
  );
}
