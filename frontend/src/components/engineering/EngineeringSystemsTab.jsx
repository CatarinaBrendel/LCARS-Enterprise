import React from "react";
import LcarsSubnav from "../LcarsSubnav.jsx";
import EngineeringTab from "./EngineeringTab.jsx";   // make sure extension matches the file
import ShipSystemsTab from "./ShipSystemsTab.jsx";

export default function EngineeringSystemsTab() {
  const [view, setView] = React.useState("engineering");

  const items = [
    { id: "engineering",  label: "ENGINEERING" },
    { id: "ship-systems", label: "SHIP SYSTEMS" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <LcarsSubnav
        value={view}
        items={items}
        onChange={(id) => {
          if (id === "engineering" || id === "ship-systems") setView(id);
        }}
      />

      {view === "engineering" ? <EngineeringTab embedded /> : <ShipSystemsTab embedded />}
    </div>
  );
}
