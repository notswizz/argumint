import { getOrCreateIO } from '@/lib/socket';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req, res) {
  if (!res.socket.server.io) {
    res.socket.server.io = getOrCreateIO(res.socket.server);
  }
  res.end();
} 