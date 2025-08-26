// components/LcarsSidebar.jsx
import LcarsPillButton from "./LcarsPillButton";

export default function LcarsSidebar({ current = "dashboard", onSelect = () => {}, className = "" }) {
  return (
    <aside
      role="navigation"
      aria-label="LCARS Navigation"
      className={`w-72 shrink-0 p-4 pt-6 flex flex-col gap-3 sticky top-0 h-screen ${className}`}
    >
      {/* TOP decorative empty block */}
      <div className="h-20 rounded-lcars bg-lcars-gold" />
      <div className="h-10 rounded-lcars bg-lcars-blue" />

      {/* Nav */}
      <LcarsPillButton color="gold"   isActive={current==='dashboard'}            onClick={()=>onSelect('dashboard')}>Dashboard</LcarsPillButton>
      <LcarsPillButton color="gold"   isActive={current==='command_operations'}   onClick={()=>onSelect('command_operations')}>Command & Operations</LcarsPillButton>
      <LcarsPillButton color="red"    isActive={current==='tactical_security'}    onClick={()=>onSelect('tactical_security')}>Tactical & Security</LcarsPillButton>
      <LcarsPillButton color="blue"   isActive={current==='science_navigation'}   onClick={()=>onSelect('science_navigation')}>Science & Navigation</LcarsPillButton>
      <LcarsPillButton color="blue"   isActive={current==='medical'}              onClick={()=>onSelect('medical')}>Medical</LcarsPillButton>
      <LcarsPillButton color="amber"  isActive={current==='engineering_systems'}  onClick={()=>onSelect('engineering_systems')}>Engineering & Ship Systems</LcarsPillButton>
      <LcarsPillButton color="copper" isActive={current==='logs'}                 onClick={()=>onSelect('logs')}>Logs</LcarsPillButton>
      <LcarsPillButton color="slate"  isActive={current==='blueprint'}            onClick={()=>onSelect('blueprint')}>Ship Blueprint</LcarsPillButton>

      {/* push bottom block to bottom */}
      <div className="flex-1" />

      {/* BOTTOM decorative empty block */}
      <div className="h-10 rounded-lcars bg-lcars-red" />
      <div className="h-20 rounded-lcars bg-lcars-purple" />
    </aside>
  );
}
