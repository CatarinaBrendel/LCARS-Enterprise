import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listMissions } from "../lib/missions";
import { getSocket } from "../lib/ws";

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
    const s = getSocket();
    s.emit("missions:subscribe", {});
    const onChanged = () => refetch();
    s.on("missions:changed", onChanged);
    return () => {
      s.off("missions:changed", onChanged);
      s.emit("missions:unsubscribe", {});
    };
  }, [refetch]);

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
    }),
    [
      missions, total, loading, err,
      page, pageSize, sortBy, sortDir,
      search, status, sector, refetch
    ]
  );
}
