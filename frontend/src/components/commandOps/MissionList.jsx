// ./frontend/src/components/commandOps/MissionList.jsx
import React, {useEffect, useMemo, useCallback, useState} from "react";
import { socket, onMissionCreated, subscribeMission, unsubscribeMission } from "../../lib/ws";
import toUiStatus from "../../utils/mission_utils";

export default function MissionList({
  // data
  missions = [],
  loading = false,
  error = "",
  // paging
  page = 1,
  pageSize = 25,
  total = 0,
  // sorting
  sortBy = "started_at",
  sortDir = "desc",
  // filters
  search = "",
  status = [],               // array of strings
  sector = "",               // string
  availableStatuses = ["NOT STARTED", "IN PROGRESS", "HOLD", "BLOCKED", "DONE"],
  availableSectors = [],     // array of strings
  // handlers
  onSelect = () => {},
  onPageChange = () => {},
  onSortChange = () => {},
  onSearchChange = () => {},
  onStatusChange = () => {}, // (nextArray)
  onSectorChange = () => {}, // (nextString)
  onClearFilters = () => {},
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [live, setLive] = useState([]);

  // subscribe to creations and keep a small live buffer
  const handleCreated = useCallback((m) => {
    console.debug("[MissionList] mission:created received", m);
    if (!matchesFilters(m, { status, sector, search })) return;
    setLive((prev) => (prev.some(x => x.id === m.id) ? prev : [m, ...prev]).slice(0, pageSize));
  }, [status, sector, search, pageSize]);

  useEffect(() => {
    const off = onMissionCreated(handleCreated);
    return off;
  }, [handleCreated]);

  // clear live buffer when leaving page 1 or changing sort/filter
  useEffect(() => {
    if (page !== 1) setLive([]);
  }, [page, sortBy, sortDir, search, sector, status]);

 useEffect(() => {
   const probe = (m) => console.debug("[MissionList] direct socket listener got mission:created", m);
   socket.on("mission:created", probe);
   return () => socket.off("mission:created", probe);
 }, []);

  const merged = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const x of [...live, ...missions]) {
      if (x && !seen.has(x.id)) { seen.add(x.id); out.push(x); }
    }
    return out;
  }, [live, missions]);

  useEffect(() => {
    subscribeMission({});
    return () => unsubscribeMission({});
  }, []);

  const handleHeaderClick = (key) => {
    const nextDir = sortBy === key && sortDir === "asc" ? "desc" : "asc";
    onSortChange?.({ sortBy: key, sortDir: nextDir });
  };

  const isStatusActive = (s) => status.includes(s);

  return (
    <div className="p-4 space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Left: Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status multi-select as pills */}
          <div className="flex flex-wrap gap-2">
            {availableStatuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  const next = isStatusActive(s)
                    ? status.filter((x) => x !== s)
                    : [...status, s];
                  onStatusChange(next);
                }}
                className={`rounded-lcars px-3 py-1 text-xs uppercase tracking-wide
                  ${isStatusActive(s)
                    ? statusColor(s)
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
                title={`Toggle: ${s}`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Sector dropdown */}
          <label className="ml-1 text-sm opacity-80">
            Sector:
            <select
              className="ml-2 rounded-lcars bg-zinc-900 ring-1 ring-zinc-800 px-2 py-1"
              value={sector}
              onChange={(e) => onSectorChange(e.target.value)}
            >
              <option value="">All</option>
              {availableSectors.map((sec) => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </label>

          {(status.length > 0 || sector || search) && (
            <button
              type="button"
              onClick={onClearFilters}
              className="rounded-lcars bg-zinc-800 hover:bg-zinc-700 px-3 py-1 text-sm"
              title="Clear filters"
            >
              Clear
            </button>
          )}
        </div>

        {/* Right: Search */}
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search code, authority, objectives…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-72 max-w-full rounded-lcars bg-zinc-900 ring-1 ring-zinc-800 px-3 py-2 placeholder:text-zinc-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg ring-1 ring-zinc-800">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-lcars-gold text-black">
              <SortableTh label="Code" active={sortBy === "code"} dir={sortDir} onClick={() => handleHeaderClick("code")} />
              <SortableTh label="Status" active={sortBy === "status"} dir={sortDir} onClick={() => handleHeaderClick("status")} />
              <SortableTh label="Sector" active={sortBy === "sector"} dir={sortDir} onClick={() => handleHeaderClick("sector")} />
              <SortableTh label="Authority" active={sortBy === "authority"} dir={sortDir} onClick={() => handleHeaderClick("authority")} />
              <SortableTh label="Progress" active={sortBy === "progress"} dir={sortDir} onClick={() => handleHeaderClick("progress")} />
            </tr>
          </thead>

          <tbody>
            {loading && <SkeletonRows rows={6} />}
            {!loading && error && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-red-400">
                  {String(error)} —{" "}
                  <button className="underline" onClick={() => onPageChange(page)}>Retry</button>
                </td>
              </tr>
            )}

            {!loading && !error && merged.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-zinc-400">
                  No missions found.
                </td>
              </tr>
            )}

            {!loading && !error && merged.map((m) => {
            const uiStatus = toUiStatus(m.status);
            const pct = coercePct(m.progress ?? m.progress_pct);
            return (
              <tr
                key={m.id ?? m.code}
                onClick={() => onSelect(m)}
                className="cursor-pointer hover:bg-lcars-purple/20 border-b border-zinc-800"
              >
                <td className="px-4 py-2">{m.code}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-lcars px-2 py-1 text-xs ${statusColor(uiStatus)}`}>
                   {uiStatus}
                  </span>
                </td>
                <td className="px-4 py-2">{m.sector}</td>
                <td className="px-4 py-2 truncate">{m.authority}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <>
                      <div className="h-2 rounded bg-lcars-gold" style={{ width: `${pct}%` }} />
                      <span className="text-xs">{pct}%</span>
                    </>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          className="px-3 py-1 rounded-lcars bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          ‹ Previous
        </button>

        <span className="px-2 text-sm opacity-80">
          Page {page} of {totalPages}
        </span>

        <button
          className="px-3 py-1 rounded-lcars bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          Next ›
        </button>
      </div>
    </div>
  );
}

function SortableTh({ label, active, dir, onClick }) {
  return (
    <th className="px-4 py-2 select-none cursor-pointer" onClick={onClick} title="Sort">
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <span className={`text-xs ${active ? "opacity-100" : "opacity-40"}`}>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </div>
    </th>
  );
}

function SkeletonRows({ rows = 6 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={`sk-${i}`} className="border-b border-zinc-800 animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-24 bg-zinc-800 rounded" /></td>
      <td className="px-4 py-3"><div className="h-5 w-20 bg-zinc-800 rounded-lcars" /></td>
      <td className="px-4 py-3"><div className="h-4 w-28 bg-zinc-800 rounded" /></td>
      <td className="px-4 py-3"><div className="h-4 w-40 bg-zinc-800 rounded" /></td>
      <td className="px-4 py-3"><div className="h-2 w-28 bg-zinc-800 rounded" /></td>
    </tr>
  ));
}

function statusColor(status) {
  switch (status) {
    case "IN PROGRESS": return "bg-lcars-gold text-black";
    case "BLOCKED":     return "bg-red-600 text-white";
    case "HOLD":        return "bg-blue-600 text-white";
    case "DONE":        return "bg-amber-700 text-black";
    case "NOT STARTED":
    default:            return "bg-zinc-600 text-white";
  }
}

function coercePct(v) {
  const n = Number.isFinite(v) ? v : Number(v ?? 0);
  return Math.max(0, Math.min(100, Math.round(n)));
}

function matchesFilters(m, { status, sector, search }) {
  const ui = toUiStatus(m.status);
  if (status?.length && !status.includes(ui)) return false;
  if (sector && m.sector !== sector) return false;
  if (search) {
    const s = search.toLowerCase();
    const hay = [m.code, m.authority, m.sector].map(v => String(v ?? '').toLowerCase());
    if (!hay.some(v => v.includes(s))) return false;
  }
  return true;
}

