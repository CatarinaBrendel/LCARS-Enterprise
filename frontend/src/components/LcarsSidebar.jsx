import LcarsPillButton from "./LcarsPillButton";

export default function LcarsSidebar({ current = "dashboard", onSelect = () => {} }) {
  return (
    <aside className="w-64 shrink-0 space-y-4 p-4 pt-6">
      <div className="h-16 w-40 rounded-lcars mb-2" />
      <LcarsPillButton color="gold"  isActive={current==='dashboard'} onClick={()=>onSelect('dashboard')}>Dashboard</LcarsPillButton>
      <LcarsPillButton color="blue"  isActive={current==='accounts'}  onClick={()=>onSelect('accounts')}>Accounts</LcarsPillButton>
      <LcarsPillButton color="amber" isActive={current==='docs'}      onClick={()=>onSelect('docs')}>Docs Guide</LcarsPillButton>
      <LcarsPillButton color="slate" isActive={current==='network'}   onClick={()=>onSelect('network')}>Network</LcarsPillButton>
    </aside>
  );
}
