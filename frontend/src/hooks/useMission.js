// src/hooks/useMission.js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentMission, getMission, setMissionStatus, setObjectiveState } from '../lib/missions';
import { getSocket } from '../lib/ws';

function useDebounced(fn, delay = 250) {
  const t = useRef(null);
  return useCallback((...args) => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export function useMission({ missionId: forcedId } = {}) {
  const [mission, setMission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const fetcher = useCallback(async (id) => {
    setLoading(true);
    setErr(null);
    try {
      const ctrl = new AbortController();
      const data = id ? await getMission(id, ctrl.signal) : await getCurrentMission(ctrl.signal);
      setMission(data);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useDebounced(() => fetcher(forcedId || mission?.id), 150);

  useEffect(() => { fetcher(forcedId); }, [fetcher, forcedId]);

  // realtime
  useEffect(() => {
    const s = getSocket();
    const id = forcedId || mission?.id || null;
    s.emit('mission:subscribe', { missionId: id });
    const onChanged = () => refetch();
    s.on('mission:changed', onChanged);
    return () => {
      s.off('mission:changed', onChanged);
      s.emit('mission:unsubscribe', { missionId: id });
    };
  }, [forcedId, mission?.id, refetch]);

  // mutations
  const updateStatus = useCallback(async (status) => {
    if (!mission?.id) return;
    await setMissionStatus(mission.id, status);
    refetch();
  }, [mission?.id, refetch]);

  const updateObjective = useCallback(async (objId, state) => {
    if (!mission?.id) return;
    await setObjectiveState(mission.id, objId, state);
    refetch();
  }, [mission?.id, refetch]);

  return useMemo(() => ({
    mission, loading, error: err,
    refetch, updateStatus, updateObjective,
  }), [mission, loading, err, refetch, updateStatus, updateObjective]);
}
