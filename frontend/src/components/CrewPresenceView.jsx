import { useMemo } from 'react';
import usePresence from '../hooks/usePresence';

function Badge({ ok, label }) {
  const cls = ok ? 'bg-[#18c56e] text-black' : 'bg-[#555] text-[#ddd]';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>{label}</span>;
}
function Pill({ children, className = '' }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${className}`}>{children}</span>;
}
function Dot({ on }) { return <span className={`inline-block w-2.5 h-2.5 rounded-full ${on ? 'bg-[#f75b4f]' : 'bg-[#3a3a3a]'}`} />; }
function Timeago({ ts }) {
  if (!ts) return <span>—</span>;
  const d = new Date(ts);
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  const s = secs < 60 ? `${secs}s` : secs < 3600 ? `${Math.floor(secs/60)}m` : `${Math.floor(secs/3600)}h`;
  return <span title={d.toLocaleString()}>{s} ago</span>;
}

export default function CrewPresenceView({onSelectCrew}) {
  const {
    list,
    onDutyCount,
    busyCount,
    busyPctOfOnDuty,
    treatmentCount,
    total,
  } = usePresence();

  const onDutyList = useMemo(() => list.filter(c => c.onDuty === true), [list]);
  const ticker = useMemo(
    () => (onDutyList.length ? onDutyList.map(c => c.name || `#${c.crewId}`).join('   •   ') : '—'),
    [onDutyList]
  );

  return (
    <div className="space-y-4 overflow-hidden">
      {/* Summary header */}
      <div className="grid grid-cols-4 gap-3">{/* ← was 3, now 4 to include Treatment */}
        <Card title="On Duty">
          <span className="text-3xl font-bold">{onDutyCount}</span>
          <span className="opacity-70 ml-1">/ {total}</span>
        </Card>
        <Card title="Busy Now">
          <span className="text-3xl font-bold">{busyCount}</span>
          <span className="opacity-70 ml-1">({busyPctOfOnDuty}% )</span>
        </Card>
        <Card title="In Treatment">{/* ← NEW */}
          <span className="text-3xl font-bold">{treatmentCount}</span>
        </Card>
        <Card title="Ticker">
          <div className="overflow-x-hidden whitespace-nowrap">
            <div className="animate-[marquee_18s_linear_infinite]">{ticker}</div>
          </div>
        </Card>
      </div>

      {/* Presence table */}
      <div className="rounded-2xl h-[60vh] overflow-auto border border-[#f2a007]/70 p-3">
        <table className="w-full text-left">
          <thead className="text-[#f2a007] uppercase text-sm">
            <tr className="[&>th]:py-2 [&>th]:px-2">
              <th>Crew</th>
              <th>On Duty</th>
              <th>Activity</th>{/* ← was 'Busy' */}
              <th>Deck Zone</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody className="text-[#e8e2d0]">
            {list.map(row => (
              <tr
                key={row.crewId}
                className="bg-black/40 border-tborder-[#f2a007]/20 [&>td]:py-2 [&>td]:px-2 cursor-pointer hover:bg-zinc-900/60"
                onClick={() => onSelectCrew?.(row.crewId)}
              >
                <td className="font-medium">{row.name || `#${row.crewId}`}</td>

                <td>
                  <Badge ok={!!row.onDuty} label={row.onDuty ? 'ON' : 'OFF'} />
                </td>

                {/* Activity column: show IN TREATMENT for patients, Busy/Idle for workers */}
                <td className="flex items-center gap-2">
                  {row.inTreatment ? (
                    <Pill className="bg-[#f75b4f] text-black">IN TREATMENT</Pill>
                  ) : (
                    <>
                      <Dot on={!!row.busy} />
                      <span className="opacity-80">{row.busy ? 'Busy' : 'Idle'}</span>
                    </>
                  )}
                </td>

                <td>
                  {row.deck_zone === 'Sickbay' && row.inTreatment ? (
                    <Pill className="bg-[#3a3a3a] text-[#e8e2d0]">Sickbay</Pill>
                  ) : (
                    row.deck_zone || '—'
                  )}
                </td>

                <td><Timeago ts={row.ts} /></td>
              </tr>
            ))}
            {!list.length && (
              <tr><td colSpan={5} className="py-6 text-center opacity-60">No active crew</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-[#f2a007]/70 p-4">
      <div className="text-[#f2a007] uppercase text-sm mb-2">{title}</div>
      <div className="text-[#e8e2d0]">{children}</div>
    </div>
  );
}
