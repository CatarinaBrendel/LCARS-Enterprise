// components/LcarsSidebar.jsx
import LcarsPillButton from "./LcarsPillButton";

export default function LcarsSidebar({ current = "dashboard", onSelect = () => {}, className = "" }) {
  return (
    <footer
      role="navigation"
      aria-label="LCARS Footer Navigation"
      className={`w-full px-4 py-3 ${className}`}
    >
      {/* LCARS trim */}
      <div className="h-2 rounded-lcars bg-lcars-gold mb-3" />
      
      <div className="grid grid-flow-col auto-cols-max gap-3 overflow-x-auto pb-2">
      {/* Nav */}
      <LcarsPillButton color="gold"   isActive={current==='dashboard'}            onClick={()=>onSelect('dashboard')}>Dashboard</LcarsPillButton>
      <LcarsPillButton color="gold"   isActive={current==='command_operations'}   onClick={()=>onSelect('command_operations')}>Command & Operations</LcarsPillButton>
      <LcarsPillButton color="red"    isActive={current==='tactical_security'}    onClick={()=>onSelect('tactical_security')}>Tactical & Security</LcarsPillButton>
      <LcarsPillButton color="blue"   isActive={current==='science_navigation'}   onClick={()=>onSelect('science_navigation')}>Science & Navigation</LcarsPillButton>
      <LcarsPillButton color="blue"   isActive={current==='medical'}              onClick={()=>onSelect('medical')}>Medical</LcarsPillButton>
      <LcarsPillButton color="amber"  isActive={current==='engineering_systems'}  onClick={()=>onSelect('engineering_systems')}>Engineering & Ship Systems</LcarsPillButton>
      <LcarsPillButton color="copper" isActive={current==='logs'}                 onClick={()=>onSelect('logs')}>Logs</LcarsPillButton>
      <LcarsPillButton color="slate"  isActive={current==='blueprint'}            onClick={()=>onSelect('blueprint')}>Ship Blueprint</LcarsPillButton>
      </div>
    </footer>
  );
}
