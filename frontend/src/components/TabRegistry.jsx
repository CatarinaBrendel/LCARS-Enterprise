
// src/tabRegistry.js
export const TABS = [
  { id: "dashboard",             title: "Dashboard" },
  { id: "command_operations",    title: "Command & Operations" },
  { id: "tactical_security",     title: "Tactical & Security" },
  { id: "science_navigation",    title: "Science & Navigation" },
  { id: "medical",               title: "Medical" },
  { id: "engineering_systems",   title: "Engineering & Ship Systems" },
  { id: "logs",                  title: "Logs" },
  { id: "blueprint",             title: "Ship Blueprint" },
];

export function getTabTitle(tabId, fallback = "Dashboard") {
  return TABS.find(t => t.id === tabId)?.title ?? fallback;
}
