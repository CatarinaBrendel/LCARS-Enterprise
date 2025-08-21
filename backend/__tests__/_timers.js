const running = new Set();

export function trackInterval(fn, ms) {
  const id = setInterval(fn, ms);
  running.add({ type: 'interval', id });
  return id;
}
export function trackTimeout(fn, ms) {
  const id = setTimeout(fn, ms);
  running.add({ type: 'timeout', id });
  return id;
}
export function clearAllTimers() {
  for (const t of running) {
    if (t.type === 'interval') clearInterval(t.id);
    else clearTimeout(t.id);
  }
  running.clear();
}
