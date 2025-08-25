// api/missions.js
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "http://localhost:3001";

export async function getCurrentMission(signal) {
  const res = await fetch(`${API_ORIGIN}/api/missions/current`, { signal });
  if (!res.ok) throw new Error(`getCurrentMission ${res.status}`);
  return res.json();
}
// …(same for the other endpoints)


export async function getMission(id, signal) {
  const res = await fetch(`${API_ORIGIN}/api/missions/${id}`, { signal });
  if (!res.ok) throw new Error(`getMission ${res.status}`);
  return res.json();
}

export async function setMissionStatus(id, status) {
  const res = await fetch(`${API_ORIGIN}/api/missions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`setMissionStatus ${res.status}`);
  return res.json();
}

export async function setObjectiveState(missionId, objId, state) {
  const res = await fetch(`${API_ORIGIN}/api/missions/${missionId}/objectives/${objId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  if (!res.ok) throw new Error(`setObjectiveState ${res.status}`);
  return res.json();
}
