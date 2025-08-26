import React, { useEffect, useMemo, useState } from "react";
import { useMissions } from '../../hooks/useMissions';
import { listSectors } from '../../lib/missions';
import MissionList from './MissionList';
import Modal from '../ui/Modal';
import MissionDetails from "./MissionDetails";

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

   const totalPages = Math.max(1, Math.ceil(total / pageSize));
   const idx = missions.findIndex(m => m.id === selectedId);

  function openPrev() {
    if (!selectedId) return;
    if (idx > 0) {
      setSelectedId(missions[idx - 1].id);
    } else if (page > 1) {
      setPendingNav('prev');
      setPage(page - 1); // when new page loads, effect below will pick last
    }
  }

  function openNext() {
    if (!selectedId) return;
    if (idx >= 0 && idx < missions.length - 1) {
      setSelectedId(missions[idx + 1].id);
    } else if (page < totalPages) {
      setPendingNav('next');
      setPage(page + 1); // when new page loads, effect below will pick first
    }
  }

 // When page data changes after a pending nav, pick the right mission on that page
 useEffect(() => {
   if (!pendingNav) return;
   if (loading) return;
   if (missions.length === 0) return;
   if (pendingNav === 'next') setSelectedId(missions[0].id);
   if (pendingNav === 'prev') setSelectedId(missions[missions.length - 1].id);
   setPendingNav(null);
 // include 'missions' and 'loading' so it fires after data arrives
 }, [missions, loading, pendingNav]);


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
        onSelect={(m) =>{setSelectedId(m?.id);}}
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
      {/* Overview Modal */}
      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} ariaLabel="Mission Overview">
        {/* Modal header controls */}
         <div className="sticky top-0 z-10 flex items-center justify-between bg-[rgb(18,18,18)] p-3 border-b border-zinc-800">
          {/* Left side: prev/next + page info */}
          <div className="flex items-center gap-3">
            <button
              className="rounded-lcars bg-zinc-800 hover:bg-zinc-700 px-3 py-1 disabled:opacity-40"
              onClick={openPrev}
              disabled={!selectedId || (idx <= 0 && page <= 1)}
            >
              ‹ Prev
            </button>
            <button
              className="rounded-lcars bg-zinc-800 hover:bg-zinc-700 px-3 py-1 disabled:opacity-40"
              onClick={openNext}
              disabled={!selectedId || (idx === missions.length - 1 && page >= totalPages)}
            >
              Next ›
            </button>
            <span className="text-sm opacity-70">Page {page} / {totalPages}</span>
          </div>
        </div>
        <MissionDetails missionId={selectedId} />
      </Modal>
    </div>
  );
}