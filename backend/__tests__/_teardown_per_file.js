import { forceReleaseAllClients } from '../database/db.js';

// Close sockets/servers if you pass them in individual suites,
// but DON'T end the DB pool here.
export async function teardownPerFile({ server, io, clients = [] } = {}) {
  for (const c of clients) {
    try { c?.disconnect?.(); } catch {}
    try { c?.close?.(); } catch {}
  }

  if (io?.close) await new Promise(r => { try { io.close(r); } catch { r(); } });

  if (server?.close) {
    await new Promise(r => {
      try { (server.close.length >= 1) ? server.close(r) : (server.close(), r()); }
      catch { r(); }
    });
  }

  try { await forceReleaseAllClients(); } catch {}
}
