import { z } from 'zod';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { signJwt } from '@/lib/auth';

const FcAuthSchema = z.object({
  fid: z.number().int().positive(),
  username: z.string().min(1),
  pfpUrl: z.string().url().optional().nullable(),
  custodyAddress: z.string().optional().nullable(),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const parsed = FcAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    const { fid, username, pfpUrl, custodyAddress } = parsed.data;
    await connectToDatabase();

    let user = await User.findOne({ fid });
    if (!user) {
      user = await User.create({
        fid,
        username,
        fcUsername: username,
        profilePictureUrl: pfpUrl || undefined,
        custodyAddress: custodyAddress || undefined,
        roles: ['user'],
      });
    } else {
      const updates = {};
      if (username && user.username !== username) {
        updates.username = username;
        updates.fcUsername = username;
      }
      if (pfpUrl && user.profilePictureUrl !== pfpUrl) {
        updates.profilePictureUrl = pfpUrl;
      }
      if (custodyAddress && user.custodyAddress !== custodyAddress) {
        updates.custodyAddress = custodyAddress;
      }
      if (Object.keys(updates).length) {
        await User.updateOne({ _id: user._id }, { $set: updates });
        user = await User.findById(user._id);
      }
    }

    const token = signJwt({ _id: user._id, fid: user.fid, username: user.username });
    res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`);
    return res.status(200).json({ user: { _id: user._id, fid: user.fid, username: user.username, tokens: user.tokens } });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: e?.message || 'unknown' });
  }
}


