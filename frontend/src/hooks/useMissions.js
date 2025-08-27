import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listMissions } from "../lib/missions";
import { subscribeMission, unsubscribeMission, onMissionEvent } from "../lib/ws";

function useDebounced(fn, delay = 250) {
  const t = useRef(null);
  return useCallback((...args) => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export function useMissions(initial = {}) {
  const [missions, setMissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [page, setPage] = useState(initial.page ?? 1);
  const [pageSize, setPageSize] = useState(initial.pageSize ?? 25);
  const [sortBy, setSortBy] = useState(initial.sortBy ?? "started_at");
  const [sortDir, setSortDir] = useState(initial.sortDir ?? "desc");
  const [search, setSearch] = useState(initial.search ?? "");
  const [status, setStatus] = useState(initial.status ?? []);
  const [sector, setSector] = useState(initial.sector ?? "");

  const [hasIncoming, setHasIncoming] = useState(false);

  const fetcher = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const ctrl = new AbortController();
      const data = await listMissions(
        { page, pageSize, sortBy, sortDir, q: search, status, sector },
        ctrl.signal
      );
      setMissions(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortDir, search, status, sector]);

  const refetch = useDebounced(fetcher, 200);

  useEffect(() => { fetcher(); }, [fetcher]);

  // realtime subscription (like useMission)
  useEffect(() => {
    // Join mission:all room
    subscribeMission({});

    // When a mission is created, refresh the list (or jump to page 1)
    const off = onMissionEvent(({ kind }) => {
      if (kind !== "created") return;
      // If you're on page 1, just refetch; otherwise jump to page 1 so it's visible
      if (page === 1) refetch();
      else setPage(1);
    });
    

    return () => {
      off();
      unsubscribeMission({});
    };
  }, [page, refetch, setPage]);

  // action for the banner/button
  const showIncoming = useCallback(() => {
    setHasIncoming(false);
    if (page !== 1) setPage(1);
    else refetch();
  }, [page, refetch, setPage]);

  return useMemo(
    () => ({
      missions, total,
      loading, error: err,
      page, setPage,
      pageSize, setPageSize,
      sortBy, setSortBy,
      sortDir, setSortDir,
      search, setSearch,
      status, setStatus,
      sector, setSector,
      refetch,
      hasIncoming, showIncoming
    }),
    [
      missions, total, loading, err,
      page, pageSize, sortBy, sortDir,
      search, status, sector, refetch,
      hasIncoming, showIncoming
    ]
  );
}
