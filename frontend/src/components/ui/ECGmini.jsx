export default function EcgMini({ ok=true }) {
  return (
    <svg width="56" height="16" viewBox="0 0 56 16" className={ok ? "opacity-90" : "opacity-60"}>
      <polyline
        fill="none"
        stroke="rgb(34,197,94)"
        strokeWidth="2"
        points="0,9 6,9 8,6 10,12 14,3 18,12 22,8 26,9 30,9 34,6 36,10 40,4 44,11 48,8 52,9 56,9"
      />
    </svg>
  );
}
