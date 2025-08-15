export default function LcarsHeaderBar({ left="DASHBOARD", right="UNITED FEDERATION OF PLANETS" }) {
  return (
    <div className="px-6 pt-6">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="text-lcars-amber text-2xl font-bold tracking-wider uppercase">{left}</div>
        </div>
        <div className="flex-1 text-right">
          <div className="text-lcars-amber text-2xl font-bold tracking-wider uppercase">{right}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-3 rounded-full bg-lcars-amber flex-1" />
        <div className="h-10 w-12 rounded-lcars bg-lcars-amber" />
      </div>
    </div>
  );
}
