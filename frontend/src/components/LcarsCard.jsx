export default function LcarsCard({ title, children, className = "" }) {
  return (
    <div className={`bg-black border border-lcars-amber/60 rounded-lcars p-4 ${className}`}>
      {title && (
        <h3 className="text-lcars-amber font-bold tracking-wider uppercase mb-2">{title}</h3>
      )}
      {children}
    </div>
  );
}
