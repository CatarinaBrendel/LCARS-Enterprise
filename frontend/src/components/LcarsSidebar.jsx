import LcarsPillButton from "./LcarsPillButton";

export default function LcarsSidebar({ current = "dashboard", onSelect = () => {}, className = "" }) {
  return (
    <aside className={`w-64 shrink-0 space-y-4 p-4 pt-6 ${className}`}>
      <div className="h-16 rounded-lcars bg-lcars-gold mb-4" />
      <LcarsPillButton color="gold"  isActive={current==='dashboard'} onClick={()=>onSelect('dashboard')}>Dashboard</LcarsPillButton>
      <LcarsPillButton color="blue"  isActive={current==='medical'}  onClick={()=>onSelect('medical')}>Medical</LcarsPillButton>
      <LcarsPillButton color="amber"  isActive={current==='systems'}  onClick={()=>onSelect('systems')}>Ship Systems</LcarsPillButton>
      <LcarsPillButton color="copper" isActive={current==='logs'}      onClick={()=>onSelect('logs')}>Logs</LcarsPillButton>
      <LcarsPillButton color="slate" isActive={current==='blueprint'}   onClick={()=>onSelect('blueprint')}>Ship Blueprint</LcarsPillButton>
    </aside>
  );
}
