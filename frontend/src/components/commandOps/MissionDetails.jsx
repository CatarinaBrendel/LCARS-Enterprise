// src/components/CommandOps/MissionOverview.jsx
import { useEffect, useState } from 'react';
import { useMission } from '../../hooks/useMission';
import Pill from '../ui/Pill';
import StatusButtons from '../ui/StatusButtons';

const STATUS_TONE = {
  not_started: 'default',
  in_progress: 'info',
  blocked: 'bad',
  done: 'warn',
};

function Progress({ percent = 0 }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="w-full mt-3">
      <div className="w-full h-3 bg-[rgb(40,40,40)] rounded">
        <div
          className="h-3 bg-lcars-amber rounded"
          style={{ width: `${p}%`, transition: 'width 600ms ease-in-out' }}
        />
      </div>
      <div className="mt-1 text-xs opacity-80">{p}% complete</div>
    </div>
  );
}

export default function MissionOverview({ setHeaderOverride }) {
  const { mission, loading, error, updateStatus, updateObjective } = useMission();
  const [pending, setPending] = useState(false);

  // Override header while mounted
  useEffect(() => {
    setHeaderOverride?.({ title: 'Mission Overview' });
    return () => setHeaderOverride?.(null);
  }, [setHeaderOverride]);

  if (loading) return <div className="p-6 opacity-70">Loading mission…</div>;
  if (error) return <div className="p-6 text-red-400">Error: {String(error.message || error)}</div>;
  if (!mission) return <div className="p-6 opacity-70">No mission.</div>;

  const { code, stardate, sector, authority, status, progress_pct, objectives = [], teams = [], events = [] } = mission;

  async function handleStatus(next) {
    if (next === status) return;      // no-op
    setPending(true);
    try { await updateStatus(next); } // this triggers a refetch via your hook
    finally { setPending(false); }
  }

  return (
    <div className="h-full overflow-y-auto p-6 pr-6 space-y-6">
      {/* Top facts + controls */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-[rgb(25,25,25)] rounded-2xl p-4 shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm uppercase tracking-wider opacity-70">Mission Code</div>
              <div className="text-2xl font-semibold">{code}</div>
            </div>
            <div className="flex gap-2">
              <StatusButtons status={status} onChange={handleStatus} pending={pending} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
            <div><div className="opacity-70">Stardate</div><div>{stardate ?? '—'}</div></div>
            <div><div className="opacity-70">Sector</div><div>{sector ?? '—'}</div></div>
            <div><div className="opacity-70">Authority</div><div>{authority ?? '—'}</div></div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="opacity-70">Status</div>
            <Pill tone={STATUS_TONE[status] ?? 'default'} className="text-sm capitalize">{status.replace('_',' ')}</Pill>
          </div>

          <Progress percent={Number(progress_pct) || 0} />
        </div>

        {/* Teams */}
        <div className="bg-[rgb(25,25,25)] rounded-2xl p-4 shadow">
          <div className="text-sm uppercase tracking-wider opacity-70">Away Teams</div>
          <div className="mt-2 space-y-3">
            {teams.length === 0 && <div className="opacity-70">No teams</div>}
            {teams.map(t => (
              <div key={t.id} className="rounded-lg bg-[rgb(35,35,35)] p-3">
                <div className="font-medium">{t.name}</div>
                <div className="text-xs opacity-70">Members: {t.members?.length ?? 0}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Objectives */}
      <div className="bg-[rgb(25,25,25)] rounded-2xl p-4 shadow">
        <div className="flex items-center justify-between">
          <div className="text-sm uppercase tracking-wider opacity-70">Objectives</div>
        </div>

        <div className="mt-2 grid md:grid-cols-2 gap-3">
          {objectives.map(o => (
            <div key={o.id} className="rounded-lg bg-[rgb(35,35,35)] p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{o.title}</div>
                <div className="text-xs opacity-70">{o.details}</div>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={STATUS_TONE[o.state] ?? 'default'} className="text-sm capitalize">{o.state.replace('_',' ')}</Pill>
                {/* quick state cycler */}
                <select
                  className="text-sm bg-black/40 rounded px-2 py-1"
                  value={o.state}
                  onChange={(e) => updateObjective(o.id, e.target.value)}
                >
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent events */}
      <div className="bg-[rgb(25,25,25)] rounded-2xl p-4 shadow">
        <div className="text-sm uppercase tracking-wider opacity-70">Recent Events</div>
        <ul className="mt-2 space-y-2 max-h-64 overflow-auto pr-2">
          {events.map(ev => (
            <li key={ev.id ?? `${ev.at}-${ev.kind}-${Math.random()}`} className="flex items-start gap-3">
              <Pill tone="default" className="bg-lcars-copper text-black text-xs">{ev.kind}</Pill>
              <div className="text-sm">
                <div className="opacity-70">{new Date(ev.at).toLocaleString()}</div>
                {ev.payload && (
                  <details className="mt-1 opacity-80">
                    <summary className="cursor-pointer">details</summary>
                    <pre className="text-xs mt-1 bg-black/30 p-2 rounded">
                      {typeof ev.payload === 'string'
                        ? ev.payload
                        : JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </li>
          ))}
          {events.length === 0 && <li className="opacity-70">No events yet</li>}
        </ul>
      </div>
    </div>
  );
}
