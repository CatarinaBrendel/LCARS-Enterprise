import { forceReleaseAllClients, endPool } from '../database/db.js';

export async function teardown({ server, io, clients = [] } = {}) {
  for (const c of clients) { 
    try { c?.disconnect?.(); } catch {} 
    try { c?.close?.(); } catch {} 
  }
  
  if (io?.close) await new Promise(r => { try { io.close(r); } catch { r(); } });
  
  if (server?.close) await new Promise(r => {
    try { if (server.close.length >= 1) server.close(r); else { server.close(); r(); } }
    catch { r(); }
  });
  await forceReleaseAllClients();
  try { await endPool(); } catch {}
}
