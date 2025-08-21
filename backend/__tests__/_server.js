import { forceReleaseAllClients, endPool } from '../database/db.js';

export async function teardown({ server, io, clients = [] } = {}) {
  // Close WS clients if any
  for (const c of clients) {
    try { c?.disconnect?.(); } catch {}
    try { c?.close?.(); } catch {}
  }

  // Close Socket.IO server
  if (io?.close) {
    await new Promise(res => { try { io.close(res); } catch { res(); } });
  }

  // Close HTTP server
  if (server?.close) {
    await new Promise(res => {
      try {
        if (server.close.length >= 1) server.close(res);
        else { server.close(); res(); }
      } catch { res(); }
    });
  }

  // Ensure NO checked-out DB clients remain
  await forceReleaseAllClients();

  // Finally, close the pool (won't hang now)
  try { await endPool(); } catch {}
}
