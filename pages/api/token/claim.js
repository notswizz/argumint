import { z } from 'zod';
import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { getCustodyAddressByFid } from '@/lib/farcaster';
import { mintToAddress } from '@/lib/chain';
import OnchainMint from '@/models/OnchainMint';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const user = await getUserFromRequest(req);
    if (!user || !user.fid) return res.status(401).json({ error: 'Unauthorized (no Farcaster session)' });

    // Basic configurable rules
    const CLAIM_AMOUNT = Number(process.env.ARG_FIRST_CLAIM_AMOUNT || 100);
    if (!Number.isFinite(CLAIM_AMOUNT) || CLAIM_AMOUNT <= 0) return res.status(500).json({ error: 'Server misconfigured claim amount' });

    await connectToDatabase();

    // Enforce one-time claim per FID
    const existing = await OnchainMint.findOne({ fid: user.fid, reason: 'first_claim' });
    if (existing && existing.txHash) {
      return res.status(200).json({ status: existing.status || 'mined', txHash: existing.txHash });
    }

    // Resolve custody address for recipient
    const to = (user.custodyAddress && user.custodyAddress.toLowerCase()) || (await getCustodyAddressByFid(user.fid));
    if (!to) return res.status(400).json({ error: 'No custody address for this FID' });

    const draft = await OnchainMint.findOneAndUpdate(
      { fid: user.fid, reason: 'first_claim' },
      { $setOnInsert: { toAddress: to, amountTokens: CLAIM_AMOUNT, status: 'pending' } },
      { new: true, upsert: true }
    );

    // Execute onchain mint
    const { hash } = await mintToAddress({ to, amountTokens: CLAIM_AMOUNT });
    await OnchainMint.updateOne({ _id: draft._id }, { $set: { txHash: hash, status: 'mined' } });

    return res.status(200).json({ status: 'mined', txHash: hash });
  } catch (e) {
    console.error('claim error', e);
    return res.status(500).json({ error: 'Server error', detail: e?.message || 'unknown' });
  }
}


