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
  } catch (e) {
    // Retry once on init errors
    try { res.socket.server.io = getOrCreateIO(res.socket.server); } catch {}
  }
  res.end();
}