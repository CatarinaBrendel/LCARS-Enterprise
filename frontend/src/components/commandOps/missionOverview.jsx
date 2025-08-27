import React, { useEffect, useMemo, useState } from "react";
import { useMissions } from "../../hooks/useMissions";
import { listSectors } from "../../lib/missions";
import MissionList from "./MissionList";
import Modal from "../ui/Modal";
import MissionDetails from "./MissionDetails";
import {
  subscribeMission, unsubscribeMission,
  onMissionProgress, onMissionStatus
} from "../../lib/ws";

/** Map backend status → list display label */
function wsToListStatus(s = "") {
  switch (String(s)) {
    case "in_progress": return "IN PROGRESS";
    case "completed":   return "DONE";
    case "hold":        return "HOLD";
    case "planned":     return "NOT STARTED";
    case "not_started": return "NOT STARTED";
    case "aborted":     return "ABORTED";
    default:            return String(s || "").toUpperCase();
  }
}
const clampPct = (n) => Math.max(0, Math.min(100, Math.round(Number(n || 0))));

export default function MissionOverview() {
  const {
    missions, total,
    page, setPage,
    pageSize,
    sortBy, setSortBy,
    sortDir, setSortDir,
    search, setSearch,
    status, setStatus,
    sector, setSector,
    loading, error,
  } = useMissions({ page: 1, pageSize: 25, sortBy: "started_at", sortDir: "desc" });

  const [sectors, setSectors] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [pendingNav, setPendingNav] = useState(null);

  // id -> { progress, status } to override rows without refetching
  const [overrides, setOverrides] = useState(() => new Map());
  const patchRow = (id, partial) => {
    if (!id) return;
    const key = String(id);
    setOverrides(prev => {
      const next = new Map(prev);
      const cur  = next.get(key) || {};
      next.set(key, { ...cur, ...partial });
      return next;
    });
  };

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    listSectors(ctrl.signal)
      .then(items => { if (alive) setSectors(items.map(x => x.sector)); })
      .catch(() => {});
    return () => { alive = false; ctrl.abort(); };
  }, []);

  // Subscribe to ALL missions so the list reacts live
  useEffect(() => {
    subscribeMission({}); // join "mission:all"

    const offProg = onMissionProgress(({ missionId, progress_pct }) => {
      patchRow(String(missionId), { progress: clampPct(progress_pct) });
    });

    const offStatus = onMissionStatus(({ missionId, status }) => {
      const s = String(status);
      const partial = { status: wsToListStatus(s) };
      if (s === "planned" || s === "not_started" || s.toUpperCase() === "NOT STARTED") {
        // ensure the progress bar resets immediately even if progress event lags
        partial.progress = 0;
      }
      patchRow(missionId, partial);
    });

    return () => {
      offProg();
      offStatus();
      unsubscribeMission({});
    };
  }, []);

  // Merge overrides into current page items
  const displayMissions = useMemo(() => {
    if (!missions?.length) return missions;
    return missions.map(m => ({ ...m, ...(overrides.get(String(m.id)) || {}) }));
   }, [missions, overrides]);

  const availableStatuses = useMemo(
    () => ["NOT STARTED", "IN PROGRESS", "HOLD", "BLOCKED", "DONE", "ABORTED"],
    []
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const idx = missions.findIndex(m => m.id === selectedId);

  function openPrev() {
    if (!selectedId) return;
    if (idx > 0) setSelectedId(missions[idx - 1].id);
    else if (page > 1) { setPendingNav("prev"); setPage(page - 1); }
  }
  function openNext() {
    if (!selectedId) return;
    if (idx >= 0 && idx < missions.length - 1) setSelectedId(missions[idx + 1].id);
    else if (page < totalPages) { setPendingNav("next"); setPage(page + 1); }
  }
  useEffect(() => {
    if (!pendingNav || loading || missions.length === 0) return;
    if (pendingNav === "next") setSelectedId(missions[0].id);
    if (pendingNav === "prev") setSelectedId(missions[missions.length - 1].id);
    setPendingNav(null);
  }, [missions, loading, pendingNav]);

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Missions</h1>

      <MissionList
        missions={displayMissions}
        loading={loading}
        error={error}
        page={page}
        pageSize={pageSize}
        total={total}
        sortBy={sortBy}
        sortDir={sortDir}
        search={search}
        status={status}
        sector={sector}
        availableStatuses={availableStatuses}
        availableSectors={sectors}
        onSelect={(m) => setSelectedId(m?.id)}
        onPageChange={setPage}
        onSortChange={({ sortBy, sortDir }) => { setSortBy(sortBy); setSortDir(sortDir); }}
        onSearchChange={(value) => {
          clearTimeout(window.__missionSearchT);
          window.__missionSearchT = setTimeout(() => setSearch(value), 250);
        }}
        onStatusChange={setStatus}
        onSectorChange={setSector}
        onClearFilters={() => { setStatus([]); setSector(""); setSearch(""); }}
      />

      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} ariaLabel="Mission Overview">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[rgb(18,18,18)] p-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <button className="rounded-lcars bg-zinc-800 hover:bg-zinc-700 px-3 py-1 disabled:opacity-40"
                    onClick={openPrev}
                    disabled={!selectedId || (idx <= 0 && page <= 1)}>
              ‹ Prev
            </button>
            <button className="rounded-lcars bg-zinc-800 hover:bg-zinc-700 px-3 py-1 disabled:opacity-40"
                    onClick={openNext}
                    disabled={!selectedId || (idx === missions.length - 1 && page >= totalPages)}>
              Next ›
            </button>
            <span className="text-sm opacity-70">Page {page} / {totalPages}</span>
          </div>
        </div>

        <MissionDetails
          missionId={selectedId}
          onLocalPatch={(partial) => {
            // DEBUG: should fire instantly when you click a new status
            console.log("[parent] local patch", selectedId, partial);
            if (!selectedId) return;
            const mapped = {};
            if (partial.status) mapped.status = wsToListStatus(partial.status);
            if (partial.progress_pct != null) mapped.progress = clampPct(partial.progress_pct);
            patchRow(selectedId, mapped);
          }}
        />
      </Modal>
    </div>
  );
}
