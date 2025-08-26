// api/missions.js
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "http://localhost:3001";

// Minimal fetcher for missions with query params
export async function fetchMissions({
  page = 1,
  pageSize = 25,
  sortBy = "started_at",
  sortDir = "desc",
  search = "",
  status = [],
  sector = "",
} = {}) {
  const params = new URLSearchParams();
  params.set("page", page);
  params.set("pageSize", pageSize);
  params.set("sortBy", sortBy);
  params.set("sortDir", sortDir);
  if (search) params.set("q", search);
  if (sector) params.set("sector", sector);
  if (status?.length) params.set("status", status.join(",")); // e.g. IN PROGRESS,DONE

  // Adjust the URL to your backend route
  const res = await fetch(`/api/missions?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to load missions (${res.status})`);
  }
  // Expected shape:
  // { items: [{id, code, status, sector, authority, progress, started_at}], total: 123 }
  return res.json();
}

export async function listMissions(params = {}, signal) {
  const u = new URLSearchParams();
  if (params.page) u.set('page', params.page);
  if (params.pageSize) u.set('pageSize', params.pageSize);
  if (params.sortBy) u.set('sortBy', params.sortBy);
  if (params.sortDir) u.set('sortDir', params.sortDir);
  if (params.q) u.set('q', params.q);
  if (params.sector) u.set('sector', params.sector);
  if (params.status?.length) u.set('status', params.status.join(','));
  const res = await fetch(`/api/missions?${u.toString()}`, { signal });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { items,total,page,pageSize }
}

export async function listSectors(signal) {
  const res = await fetch('/api/missions/sectors', { signal });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json(); // { items: [{sector, count}] }
  return data.items ?? [];
}

export async function getCurrentMission(signal) {
  const res = await fetch(`${API_ORIGIN}/api/missions/current`, { signal });
  if (!res.ok) throw new Error(`getCurrentMission ${res.status}`);
  return res.json();
}

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
