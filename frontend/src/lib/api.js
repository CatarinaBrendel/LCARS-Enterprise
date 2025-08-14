import toErrorMessage from '../utils/helpers'
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 8000,
  headers: { Accept: 'application/json' },
})

// Example call: Crew-status
export async function getCrewStatus() {
  const start = performance.now()
  try {
    const res = await api.get('/crew-status') // adjust path if needed
    const latencyMs = Math.round(performance.now() - start)
    return { data: res.data, latencyMs }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start)
    const message = toErrorMessage(err)
    // Re-throw with a cleaner message (and keep latency for UI)
    const wrapped = new Error(message)
    wrapped.latencyMs = latencyMs
    throw wrapped
  }
}
