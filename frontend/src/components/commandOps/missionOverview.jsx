import React, { useEffect, useMemo, useState, useRef } from "react";
import { useMissions } from "../../hooks/useMissions";
import { listSectors } from "../../lib/missions";
import MissionList from "./MissionList";
import Modal from "../ui/Modal";
import MissionDetails from "./MissionDetails";
import {
  subscribeMission, unsubscribeMission,
  onMissionProgress, onMissionStatus, onMissionCreated
} from "../../lib/ws";
import toUiStatus from "../../utils/mission_utils";
import { fetchMissionById } from "../../lib/api";

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

// add this helper near the top of the file
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
  const inflightRef = useRef(new Set());

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

  // ── LIVE BUFFER (prepend new missions on page 1) ────────────────────────────
  const [live, setLive] = useState([]);

  // refs to keep latest filter/page values without re-subscribing
  const stRef = React.useRef({ status, sector, search, page, pageSize });
  useEffect(() => { stRef.current = { status, sector, search, page, pageSize }; },
                [status, sector, search, page, pageSize]);

  // subscribe to "all" ONCE
  useEffect(() => {
    subscribeMission({});
    return () => unsubscribeMission({});
  }, []);

  // listen to mission:created ONCE; push into live if visible under current filters and on page 1
  useEffect(() => {
    const handler = (m) => {
      const { status, sector, search, page, pageSize } = stRef.current;
      if (page !== 1) return;

      const ui = toUiStatus(m.status);
      if (status?.length && !status.includes(ui)) return;
      if (sector && m.sector !== sector) return;
      if (search) {
        const s = search.toLowerCase();
        const hay = [m.code, m.authority, m.sector].map(v => String(v ?? '').toLowerCase());
        if (!hay.some(v => v.includes(s))) return;
      }

      setLive(prev => (prev.some(x => x.id === m.id) ? prev : [m, ...prev]).slice(0, pageSize));
    };

    const off = onMissionCreated(handler);
    return off; // removed only on unmount
  }, []);

  // clear or trim live when paging/sorting/filtering away
  useEffect(() => {
    if (page !== 1) setLive([]);
    else setLive(prev => prev.slice(0, pageSize));
  }, [page, sortBy, sortDir, search, sector, status, pageSize]);
  // ── END LIVE BUFFER ────────────────────────────────────────────────────────

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    listSectors(ctrl.signal)
      .then(items => { if (alive) setSectors(items.map(x => x.sector)); })
      .catch(() => {});
    return () => { alive = false; ctrl.abort(); };
  }, []);

  // WS status/progress overrides (register ONCE)
  useEffect(() => {
    const offProg = onMissionProgress(({ missionId, progress_pct }) => {
      patchRow(String(missionId), { progress: clampPct(progress_pct) });
    });
    
     const offStatus = onMissionStatus(async ({ missionId, status }) => {
    const s = String(status);
    const idStr = String(missionId);

    // patch existing rows
    const partial = { status: wsToListStatus(s) };
    if (s === "planned" || s === "not_started" || s.toUpperCase() === "NOT STARTED") {
      partial.progress = 0;
    }
    patchRow(idStr, partial);

    // If mission is not on current page, fetch it
    const { status: filtStatus, sector, search, page, pageSize } = stRef.current;
    if (page !== 1) return;

    const alreadyHere = [...live, ...missions].some(m => String(m?.id) === idStr);
    if (alreadyHere) return;

    if (inflightRef.current.has(idStr)) return;
    inflightRef.current.add(idStr);

    try {
    const { data: m } = await fetchMissionById(idStr);
    const next = { ...m, status: s };

      if (matchesFilters(next, { status: filtStatus, sector, search })) {
        setLive(prev =>
          (prev.some(x => String(x.id) === idStr) ? prev : [next, ...prev]).slice(0, pageSize)
        );
      }
    } catch (err) {
      console.warn("fetchMissionById error", idStr, err);
    } finally {
      inflightRef.current.delete(idStr);
    }
  });
    
    const offCreated = onMissionCreated((m) => {
      const { status: filtStatus, sector, search, page, pageSize } = stRef.current;
      if (page !== 1) return;
      if (matchesFilters(m, { status: filtStatus, sector, search })) {
        setLive(prev => (prev.some(x => x.id === m.id) ? prev : [m, ...prev]).slice(0, pageSize));
      }
    });

    return () => { offProg(); offStatus(); offCreated(); };
  }, [live, missions]);

  // Merge: live (new first) + server page, then apply overrides; dedupe by id
  const displayMissions = useMemo(() => {
    const seen = new Set();
    const merged = [...live, ...missions].filter(x => {
      if (!x) return false;
      const id = x.id ?? x.code; // safety
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return merged.map(m => ({ ...m, ...(overrides.get(String(m.id)) || {}) }));
  }, [missions, live, overrides]);

  const availableStatuses = useMemo(
    () => ["NOT STARTED", "IN PROGRESS", "HOLD", "BLOCKED", "DONE", "ABORTED"],
    []
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const idx = (displayMissions ?? []).findIndex(m => m.id === selectedId);

  function openPrev() {
    if (!selectedId) return;
    if (idx > 0) setSelectedId(displayMissions[idx - 1].id);
    else if (page > 1) { setPendingNav("prev"); setPage(page - 1); }
  }
  function openNext() {
    if (!selectedId) return;
    if (idx >= 0 && idx < displayMissions.length - 1) setSelectedId(displayMissions[idx + 1].id);
    else if (page < totalPages) { setPendingNav("next"); setPage(page + 1); }
  }
  useEffect(() => {
    if (!pendingNav || loading || displayMissions.length === 0) return;
    if (pendingNav === "next") setSelectedId(displayMissions[0].id);
    if (pendingNav === "prev") setSelectedId(displayMissions[displayMissions.length - 1].id);
    setPendingNav(null);
  }, [displayMissions, loading, pendingNav]);

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Missions</h1>

      {/* Optional: show a small hint when live buffer has items */}
      {page === 1 && live.length > 0 && (
        <div className="mb-3 text-sm opacity-70">
          Showing {live.length} new mission{live.length > 1 ? "s" : ""} live…
        </div>
      )}

      <MissionList
        missions={displayMissions}
        loading={loading && (displayMissions?.length ?? 0) === 0}
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
                    disabled={!selectedId || (idx === displayMissions.length - 1 && page >= totalPages)}>
              Next ›
            </button>
            <span className="text-sm opacity-70">Page {page} / {totalPages}</span>
          </div>
        </div>

        <MissionDetails
          missionId={selectedId}
          onLocalPatch={(partial) => {
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
