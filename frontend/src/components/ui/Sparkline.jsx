export default function Sparkline({ data = [], width = 220, height = 34, min, max, stroke = "currentColor", strokeWidth = 2 }) {
  if (!data.length) return <div className="h-[34px] opacity-40 text-xs">—</div>;
  const xs = data.map(d => +new Date(d.t));
  const ys = data.map(d => (d.v == null ? null : Number(d.v))).filter(v => v != null);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = min != null ? min : Math.min(...ys);
  const yMax = max != null ? max : Math.max(...ys);
  const scaleX = (x) => xMax === xMin ? 0 : ((x - xMin) / (xMax - xMin)) * (width - 4) + 2;
  const scaleY = (y) => yMax === yMin ? height/2 : height - (((y - yMin) / (yMax - yMin)) * (height - 4) + 2);
  const pts = data.filter(d => d.v != null).map(d => `${scaleX(+new Date(d.t)).toFixed(1)},${scaleY(Number(d.v)).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="opacity-90">
      <polyline fill="none" stroke={stroke} strokeWidth={strokeWidth} points={pts} />
    </svg>
  );
}
