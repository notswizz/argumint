import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    await connectToDatabase();
    // Drop old email index variants that may enforce uniqueness on null
    try { await User.collection.dropIndex('email_1'); } catch (_) {}
    try { await User.collection.dropIndex('email_1_sparse'); } catch (_) {}
    // Recreate the partial unique index
    await User.collection.createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to repair index', detail: e?.message || 'unknown' });
  }
}


