import { z } from 'zod';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { signJwt } from '@/lib/auth';

const FcAuthSchema = z.object({
  fid: z.coerce.number().int().positive(),
  username: z.string().optional().nullable(),
  pfpUrl: z.string().optional().nullable(),
  custodyAddress: z.string().optional().nullable(),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const parsed = FcAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      const issues = parsed.error.issues?.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      return res.status(400).json({ error: 'Invalid input', detail: issues || undefined });
    }
    const { fid, username, pfpUrl, custodyAddress } = parsed.data;

    const canonicalUsername = (username && String(username).trim().length > 0)
      ? String(username).trim()
      : `fid-${fid}`;
    const safePfpUrl = pfpUrl && /^https?:\/\//i.test(String(pfpUrl)) ? String(pfpUrl) : undefined;
    const safeCustody = custodyAddress && String(custodyAddress).trim().length > 0 ? String(custodyAddress) : undefined;

    await connectToDatabase();

    let user;
    try {
      user = await User.findOneAndUpdate(
        { fid },
        {
          $setOnInsert: {
            fid,
            username: canonicalUsername,
            fcUsername: canonicalUsername,
            roles: ['user'],
          },
          $set: {
            ...(safePfpUrl ? { profilePictureUrl: safePfpUrl } : {}),
            ...(safeCustody ? { custodyAddress: safeCustody } : {}),
          },
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      // Fallback: if upsert fails (e.g., transient/dup key race), ensure user exists
      console.error('Farcaster upsert error:', err?.message || err);
      user = await User.findOne({ fid });
      if (!user) {
        user = await User.create({
          fid,
          username: canonicalUsername,
          fcUsername: canonicalUsername,
          profilePictureUrl: safePfpUrl,
          custodyAddress: safeCustody,
          roles: ['user'],
        });
      }
    }

    const token = signJwt({ _id: user._id, fid: user.fid, username: user.username });
    res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=None; Secure`);
    return res.status(200).json({ user: { _id: user._id, fid: user.fid, username: user.username, tokens: user.tokens } });
  } catch (e) {
    console.error('Farcaster auth error:', e);
    return res.status(500).json({ error: 'Server error', detail: e?.message || 'unknown' });
  }
}


