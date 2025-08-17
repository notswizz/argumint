import { getOrCreateIO } from '@/lib/socket';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req, res) {
  try {
    if (!res.socket.server.io) {
      res.socket.server.io = getOrCreateIO(res.socket.server);
    }
    // Touch to ensure listeners attach in dev hot-reload
    res.socket.server.io.engine && res.socket.server.io.engine.on && res.socket.server.io.engine.on('connection_error', () => {});
  } catch (e) {
    // Retry once on init errors
    try { res.socket.server.io = getOrCreateIO(res.socket.server); } catch {}
  }
  res.end();
}