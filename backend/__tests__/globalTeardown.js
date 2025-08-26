// backend/__tests__/global-teardown.js
import { endPool, forceReleaseAllClients } from '../database/db.js';

export async function teardown() {
  await forceReleaseAllClients();
  try { await endPool(); } catch {}
}
