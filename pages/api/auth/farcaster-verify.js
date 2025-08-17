import { z } from 'zod';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { signJwt } from '@/lib/auth';
import { verifyMessage } from 'viem';

const VerifySchema = z.object({
  message: z.string().min(1),
  signature: z.string().min(1),
  address: z.string().min(1),
  fid: z.number().int().positive(),
  username: z.string().min(1),
  pfpUrl: z.string().url().optional().nullable(),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const parsed = VerifySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
    const { message, signature, address, fid, username, pfpUrl } = parsed.data;

    const verified = await verifyMessage({ address, message, signature });
    if (!verified) return res.status(401).json({ error: 'Invalid signature' });

    await connectToDatabase();
    let user = await User.findOne({ fid });
    if (!user) {
      user = await User.create({ fid, username, fcUsername: username, profilePictureUrl: pfpUrl || undefined, custodyAddress: address });
    } else {
      const updates = {};
      if (user.username !== username) { updates.username = username; updates.fcUsername = username; }
      if (user.profilePictureUrl !== pfpUrl && pfpUrl) { updates.profilePictureUrl = pfpUrl; }
      if (user.custodyAddress !== address) { updates.custodyAddress = address; }
      if (Object.keys(updates).length) {
        await User.updateOne({ _id: user._id }, { $set: updates });
        user = await User.findById(user._id);
      }
    }

    const token = signJwt({ _id: user._id, fid: user.fid, username: user.username, address });
    res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`);
    return res.status(200).json({ user: { _id: user._id, fid: user.fid, username: user.username, tokens: user.tokens } });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: e?.message || 'unknown' });
  }
}


