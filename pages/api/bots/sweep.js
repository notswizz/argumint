export default function handler(req, res) {
  return res.status(410).json({ error: 'bots disabled' });
}


