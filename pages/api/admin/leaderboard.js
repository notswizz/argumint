import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';

export default async function handler(req, res) {
  await connectToDatabase();
  const users = await User.find({}).sort({ tokens: -1 }).limit(50).select('username tokens').lean();
  return res.status(200).json({ users });
} 