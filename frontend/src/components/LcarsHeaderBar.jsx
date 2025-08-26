export default function LcarsHeaderBar({  title = "Dashboard", rightContent = "Uniter Federation of Planets" }) {
  return (
    <div className="px-6 pt-6 mb-4">
      <div className="mb-2 flex items-center gap-3">
        <div className="h-10 rounded-full bg-lcars-amber flex-1" />
        <div className="h-10 w-12 rounded-lcars bg-lcars-amber" />
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="text-lcars-amber text-2xl font-bold tracking-wider uppercase">{title}</div>
        </div>
        <div className="flex-1 text-right">
          <div className="text-lcars-amber text-2xl font-bold tracking-wider uppercase">
            {rightContent}
          </div>
        </div>
      </div>
    </div>
  );
}
