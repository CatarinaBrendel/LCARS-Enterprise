import LcarsPillButton from "./LcarsPillButton";

export default function LcarsSidebar({ current = "dashboard", onSelect = () => {}, className = "" }) {
  return (
    <aside className={`w-64 shrink-0 space-y-4 p-4 pt-6 ${className}`}>
      <div className="h-16 rounded-lcars bg-lcars-gold mb-4" />
      <LcarsPillButton color="gold"  isActive={current==='dashboard'} onClick={()=>onSelect('dashboard')}>Dashboard</LcarsPillButton>
      <LcarsPillButton color="gold"  isActive={current==='command_operations'} onClick={()=>onSelect('command_operations')}>Command & Operations</LcarsPillButton>
      <LcarsPillButton color="red"  isActive={current==='tactical_security'} onClick={()=>onSelect('tactical_security')}>Tactical & Security</LcarsPillButton>
      <LcarsPillButton color="blue"  isActive={current==='science_navigation'} onClick={()=>onSelect('science_navigation')}>Science & Navigation</LcarsPillButton>
      <LcarsPillButton color="blue"  isActive={current==='medical'}  onClick={()=>onSelect('medical')}>Medical</LcarsPillButton>
      <LcarsPillButton color="amber"  isActive={current==='engineering_systems'}  onClick={()=>onSelect('engineering_systems')}>Engineering & Ship Systems</LcarsPillButton>
      <LcarsPillButton color="copper" isActive={current==='logs'}      onClick={()=>onSelect('logs')}>Logs</LcarsPillButton>
      <LcarsPillButton color="slate" isActive={current==='blueprint'}   onClick={()=>onSelect('blueprint')}>Ship Blueprint</LcarsPillButton>
    </aside>
  );
}
