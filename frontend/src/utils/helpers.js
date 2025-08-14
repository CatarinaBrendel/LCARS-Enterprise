// Optional: unify error messages
export default function toErrorMessage(error) {
  if (error.response) {
    const { status, statusText, data } = error.response
    let extra = ''
    if (data && typeof data === 'object') {
      try { extra = JSON.stringify(data) } catch { /* ignore */ }
    } else if (typeof data === 'string') {
      extra = data
    }
    return `HTTP ${status} ${statusText}${extra ? ` — ${extra}` : ''}`
  }
  if (error.request) return 'No response received from server'
  return error.message || 'Request failed'
}