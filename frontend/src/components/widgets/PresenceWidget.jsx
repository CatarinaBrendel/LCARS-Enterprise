// frontend/src/components/widgets/PresenceWidget.jsx
import React, { useEffect, useState } from 'react';
import usePresence from '../../hooks/usePresence';

function sinceString(ts) {
  if (!ts) return '—';
  const secs = Math.max(0, Math.floor((Date.now() - Date.parse(ts)) / 1000));
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`;
}

export default function PresenceWidget({ className = '' }) {
  const { onDutyCount, busyCount, offDutyCount, busyPctOfOnDuty, topZones, lastUpdated, total } = usePresence();

  // keep “updated … ago” fresh
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick(t => (t + 1) % 1e6), 1000); return () => clearInterval(id); }, []);

  const R = 46, C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, busyPctOfOnDuty));
  const dash = (pct / 100) * C;

  return (
    <section
      className={[
        'rounded-[28px] border border-[#f2a007]/70 bg-black/40 p-0 overflow-hidden',
        className,
      ].join(' ')}
      aria-label="Crew Presence"
    >
      <header className="flex items-center justify-between px-5 py-3 border-b border-[#f2a007]/40">
        <h3 className="uppercase tracking-[0.25em] text-lg font-semibold text-[#f2a007]">Crew</h3>
        <div className="text-xs text-[#e8e2d0]/80">updated {sinceString(lastUpdated)} ago</div>
      </header>

      {/* body: 2 columns with a vertical divider in the middle */}
      <div className="grid grid-cols-[1fr_1px_1fr] gap-0 px-5 py-5">
        {/* LEFT column */}
        <div className="pr-5 flex flex-col gap-4">
          {/* ring */}
          <div className="self-start sm:self-center">
            <svg width="124" height="124" viewBox="0 0 124 124" role="img" aria-label={`Busy ${pct}%`}>
              <circle cx="62" cy="62" r={R} fill="none" stroke="#2a2a2a" strokeWidth="12" />
              <circle
                cx="62" cy="62" r={R} fill="none"
                stroke="#f2a007" strokeWidth="12" strokeLinecap="round"
                strokeDasharray={`${dash} ${C - dash}`}
                transform="rotate(-90 62 62)"
              />
              <text x="62" y="54" textAnchor="middle" fontSize="22" fill="#e8e2d0" fontWeight="700">
                {busyCount}/{onDutyCount}
              </text>
              <text x="62" y="94" textAnchor="middle" fontSize="14" fill="#f2a007" fontWeight="600">
                {pct}%
              </text>
            </svg>
          </div>

          {/* label under ring */}
          <div className="text-[#e8e2d0] text-lg font-medium">Busy / on-duty</div>

          {/* on/off minib ar with captions */}
          <div className="mt-1">
            <MiniBar left={onDutyCount} right={offDutyCount} />
            <div className="flex justify-between text-[11px] mt-1">
              <span className="text-[#18c56e] font-semibold">ON</span>
              <span className="text-[#e8e2d0]/60 font-semibold">OFF</span>
            </div>
            <div className="text-[11px] text-[#e8e2d0]/65 mt-1">
              Busy % of on-duty <span className="mx-1">•</span> Total crew {total}
            </div>
          </div>
        </div>

        {/* vertical divider */}
        <div className="w-px bg-[#f2a007]/25" />

        {/* RIGHT column */}
        <div className="pl-5">
          <div className="grid gap-1 mb-4">
            <RowStat label="ON DUTY" value={onDutyCount} />
            <RowStat label="OFF DUTY" value={offDutyCount} dim />
          </div>

          <div className="uppercase text-xs text-[#f2a007] tracking-wider mb-2">Top Zones</div>
          <ul className="space-y-2">
            {topZones.slice(0, 4).map(([zone, count]) => (
              <li key={zone} className="flex items-center justify-between text-base">
                <span className="text-[#e8e2d0]">{zone}</span>
                <span className="inline-flex min-w-[28px] justify-center px-2 py-0.5 rounded-full bg-[#2a2a2a] text-[#f2a007] font-semibold">
                  {count}
                </span>
              </li>
            ))}
            {topZones.length === 0 && <li className="text-[#e8e2d0]/60 text-sm">—</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}

function RowStat({ label, value, dim = false }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`uppercase tracking-widest text-sm ${dim ? 'text-[#f2a007]/70' : 'text-[#f2a007]'}`}>
        {label}
      </span>
      <span className={`text-4xl font-extrabold ${dim ? 'text-[#e8e2d0]/80' : 'text-[#e8e2d0]'}`}>
        {value}
      </span>
    </div>
  );
}

function MiniBar({ left, right }) {
  const total = Math.max(1, left + right);
  const lPct = Math.round((left / total) * 100);
  const rPct = 100 - lPct;
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-[#2a2a2a] flex">
      <div className="h-full bg-[#18c56e]" style={{ width: `${lPct}%` }} />
      <div className="h-full bg-[#555]" style={{ width: `${rPct}%` }} />
    </div>
  );
}
