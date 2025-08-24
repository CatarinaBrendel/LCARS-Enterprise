export default function Card({ title, children, className="" }) {
  return (
    <section className={`bg-black/60 rounded-2xl border border-zinc-800 p-4 ${className}`}>
      {title && <h3 className="text-lcars-amber text-lg font-extrabold mb-3 tracking-widest">{title}</h3>}
      {children}
    </section>
  );
}
