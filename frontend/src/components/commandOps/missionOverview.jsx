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

function matchesFilters(m, { status, sector, search }) {
  const ui = toUiStatus(m.status);
  if (status?.length && !status.includes(ui)) return false;
  if (sector && m.sector !== sector) return false;
  if (search) {
    const s = search.toLowerCase();
    const hay = [m.code, m.authority, m.sector].map(v => String(v ?? "").toLowerCase());
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
  } = useMissions({ page: 1, pageSize: 10, sortBy: "started_at", sortDir: "desc" });

  const [sectors, setSectors] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [pendingNav, setPendingNav] = useState(null);
  const inflightRef = useRef(new Set());
  const searchTimerRef = useRef(null);

  // id -> { progress, status } to override rows without refetching
  const [overrides, setOverrides] = useState(() => new Map());
  const patchRow = (id, partial) => {
    if (!id) return;
    const key = String(id);
    setOverrides(prev => {
      const next = new Map(prev);
      next.set(key, { ...(next.get(key) || {}), ...partial });
      return next;
    });
  };

  // ── LIVE BUFFER (prepend new missions on page 1) ────────────────────────────
  const [live, setLive] = useState([]);

  // keep latest filters/page in a ref for WS handlers
  const stRef = useRef({ status, sector, search, page, pageSize });
  useEffect(() => { stRef.current = { status, sector, search, page, pageSize }; },
    [status, sector, search, page, pageSize]);

  // subscribe to "all" once
  useEffect(() => {
    subscribeMission({});
    return () => unsubscribeMission({});
  }, []);

  // created → push to live if visible & on page 1 (register once)
  useEffect(() => {
    const handler = (m) => {
      const { status, sector, search, page, pageSize } = stRef.current;
      if (page !== 1) return;
      if (!matchesFilters(m, { status, sector, search })) return;
      setLive(prev => (prev.some(x => String(x.id) === String(m.id)) ? prev : [m, ...prev]).slice(0, pageSize));
    };
    const off = onMissionCreated(handler);
    return off;
  }, []);

  // trim/clear live when paging/sorting/filtering away
  useEffect(() => {
    if (page !== 1) setLive([]);
    else setLive(prev => prev.slice(0, pageSize));
  }, [page, sortBy, sortDir, search, sector, status, pageSize]);
  // ── END LIVE BUFFER ────────────────────────────────────────────────────────

  // sectors list
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    listSectors(ctrl.signal)
      .then(items => { if (alive) setSectors(items.map(x => x.sector)); })
      .catch(() => {});
    return () => { alive = false; ctrl.abort(); };
  }, []);

  // WS overrides (register once)
  useEffect(() => {
    const offProg = onMissionProgress(({ missionId, progress_pct }) => {
      patchRow(String(missionId), { progress: clampPct(progress_pct) });
    });

    const offStatus = onMissionStatus(async ({ missionId, status }) => {
      const s = String(status);
      const idStr = String(missionId);

      // patch if it's already shown
      const partial = { status: wsToListStatus(s) };
      if (s === "planned" || s === "not_started" || s.toUpperCase() === "NOT STARTED") {
        partial.progress = 0;
      }
      patchRow(idStr, partial);

      // if not on current page 1, try to fetch & show in live (respect filters)
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

    return () => { offProg(); offStatus(); };
  }, [live, missions]);

  // Merge: live (new first) + server page, then apply overrides; dedupe by id
  const displayMissions = useMemo(() => {
    const seen = new Set();
    const merged = [...live, ...missions].filter(x => {
      if (!x) return false;
      const id = String(x.id ?? x.code);
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

  const totalPages = Math.max(1, Math.ceil((total || 0) / Math.max(1, pageSize || 0)));
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

  // keep details live while modal is open
  useEffect(() => {
    if (!selectedId) return;
    subscribeMission({ missionId: selectedId });
    return () => unsubscribeMission({ missionId: selectedId });
  }, [selectedId]);

  return (
    <div className="px-4 py-2">
      <div className="mb-2 flex flex-wrap justify-center items-baseline gap-x-3 gap-y-2">
        <h1 className="text-2xl" >Missions</h1>
        {page === 1 && live.length > 0 && (
          <div className="text-sm opacity-70" aria-live="polite">
            Showing {live.length} new mission{live.length > 1 ? "s" : ""} live…
          </div>
        )}
      </div>

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

        // debounce via ref + reset page to 1
        onSearchChange={(value) => {
          if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
          searchTimerRef.current = setTimeout(() => { setPage(1); setSearch(value); }, 250);
        }}

        // reset page to 1 on filter changes
        onStatusChange={(v) => { setPage(1); setStatus(v); }}
        onSectorChange={(v) => { setPage(1); setSector(v); }}
        onClearFilters={() => { setStatus([]); setSector(""); setSearch(""); setPage(1); }}
      />

      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} ariaLabel="Mission Overview">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-zinc-900/95 backdrop-blur p-3 border-b border-zinc-800">
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
          <button
            className="rounded-lcars bg-zinc-800 hover:bg-zinc-700 px-3 py-1"
            onClick={() => setSelectedId(null)}
            aria-label="Close mission details"
          >
            Close ✕
          </button>
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
