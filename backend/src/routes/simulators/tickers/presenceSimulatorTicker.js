import { computeEffectiveSummary } from '../../presence/service.js';

export function startPresenceSummaryTicker({
  emitPresenceSummary,
  intervalMs = 10_000,
  logger = console,
} = {}) {
  let timer = null;

  async function tick() {
    try {
      const s = await computeEffectiveSummary();
      emitPresenceSummary?.(s);
    } catch (e) {
      logger.warn('[presence-summary] tick failed:', e?.message || e);
    }
  }

  // fire once on boot, then on interval
  tick();
  timer = setInterval(tick, intervalMs);

  return function stop() {
    if (timer) clearInterval(timer);
    logger.log('[presence-summary] stopped');
  };
}
