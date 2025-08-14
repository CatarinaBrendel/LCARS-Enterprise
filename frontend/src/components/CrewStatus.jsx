import { useEffect, useState } from 'react'
import { getCrewStatus } from '../lib/api'

export default function CrewStatusProbe() {
  const [state, setState] = useState('idle') // 'idle' | 'loading' | 'ok' | 'error'
  const [latency, setLatency] = useState(null)
  const [payload, setPayload] = useState(null)
  const [err, setErr] = useState(null)

  async function check() {
    setState('loading')
    setErr(null)
    setLatency(null)
    setPayload(null)

    try {
      const { data, latencyMs } = await getCrewStatus()
      setLatency(latencyMs)
      setPayload(data)
      setState('ok')
    } catch (e) {
      setErr(e.message || String(e))
      setLatency(e.latencyMs ?? null)
      setState('error')
    }
  }

  useEffect(() => { check() }, [])

  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <strong>Crew-status probe</strong>
        <button onClick={check} disabled={state === 'loading'}>
          {state === 'loading' ? 'Checking…' : 'Re-check'}
        </button>
      </div>

      {state === 'loading' && <div>⌛ Checking…</div>}

      {state === 'ok' && (
        <div>
          <div>✅ Reached endpoint {latency !== null ? `in ${latency} ms` : ''}</div>
          <pre style={{ marginTop: 8, background: '#f7f7f7', padding: 8, borderRadius: 6 }}>
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      )}

      {state === 'error' && (
        <div>
          <div>❌ Couldn’t reach endpoint{latency != null ? ` (after ${latency} ms)` : ''}</div>
          <pre style={{ marginTop: 8, background: '#fff4f4', padding: 8, borderRadius: 6, color: '#a00' }}>
            {err}
          </pre>
        </div>
      )}
    </div>
  )
}