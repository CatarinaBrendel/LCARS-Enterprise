import React, { useEffect, useMemo, useState } from "react";
import { useMissions } from "../../hooks/useMissions";
import { listSectors } from "../../lib/missions";
import MissionList from "./MissionList";

export default function MissionsPage({ onSelectMission = () => {} }) {
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

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    listSectors(ctrl.signal)
      .then(items => { if (alive) setSectors(items.map(x => x.sector)); })
      .catch(() => {}); // optional: surface error
    return () => { alive = false; ctrl.abort(); };
  }, []);

  const availableStatuses = useMemo(
    () => ["NOT STARTED", "IN PROGRESS", "HOLD", "BLOCKED", "DONE", "ABORTED"],
    []
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Missions</h1>

      <MissionList
        // data
        missions={missions}
        loading={loading}
        error={error}
        // paging/sort
        page={page}
        pageSize={pageSize}
        total={total}
        sortBy={sortBy}
        sortDir={sortDir}
        // filters
        search={search}
        status={status}
        sector={sector}
        availableStatuses={availableStatuses}
        availableSectors={sectors}
        // handlers
        onSelect={onSelectMission}
        onPageChange={setPage}
        onSortChange={({ sortBy, sortDir }) => { setSortBy(sortBy); setSortDir(sortDir); }}
        onSearchChange={(value) => {
          // quick debounce inline (optional)
          clearTimeout(window.__missionSearchT);
          window.__missionSearchT = setTimeout(() => setSearch(value), 250);
        }}
        onStatusChange={setStatus}
        onSectorChange={setSector}
        onClearFilters={() => { setStatus([]); setSector(""); setSearch(""); }}
      />
    </div>
  );
}