import { z } from 'zod';
import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { getCustodyAddressByFid } from '@/lib/farcaster';
import { formatClaimTransaction } from '@/lib/claim';
import OnchainMint from '@/models/OnchainMint';
import { getTokenDecimals } from '@/lib/chain';
import { createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const ClaimBody = z.object({
  // Optional override; if omitted, we use custody address from FID
  to: z.string().optional(),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const user = await getUserFromRequest(req);
    if (!user?.fid) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = ClaimBody.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

    await connectToDatabase();

    const CLAIM_AMOUNT = Number(process.env.ARG_FIRST_CLAIM_AMOUNT || 100);
    const CLAIM_CONTRACT = process.env.ARG_CLAIM_CONTRACT_ADDRESS;
    if (!CLAIM_CONTRACT) return res.status(500).json({ error: 'Claim contract not configured' });

    // Enforce one-time claim per FID using server-side nonce 0
    const existing = await OnchainMint.findOne({ fid: user.fid, reason: 'first_claim' });
    if (existing?.txHash) {
      return res.status(409).json({ error: 'Already claimed', txHash: existing.txHash });
    }

    // Resolve recipient
    const to = (parsed.data.to || user.custodyAddress || (await getCustodyAddressByFid(user.fid)) || '').toLowerCase();
    if (!to) return res.status(400).json({ error: 'No custody address' });

    // Sign an authorization message that the claim contract will verify (server-signed allowlist)
    const signerPk = process.env.CLAIM_SIGNER_PRIVATE_KEY;
    if (!signerPk) return res.status(500).json({ error: 'Server signer not configured' });
    const account = privateKeyToAccount(signerPk.startsWith('0x') ? signerPk : `0x${signerPk}`);
    const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(process.env.BASE_RPC_URL || 'https://sepolia.base.org') });

    const nonce = 0; // first-claim nonce
    const decimals = await getTokenDecimals();
    const amount = parseUnits(String(CLAIM_AMOUNT), decimals);

    // EIP-712 signature that ArgumintClaim verifies
    const signature = await wallet.signTypedData({
      domain: { name: 'ArgumintClaim', version: '1', chainId: baseSepolia.id, verifyingContract: CLAIM_CONTRACT },
      types: {
        Claim: [
          { name: 'recipient', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'fid', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
        ],
      },
      primaryType: 'Claim',
      message: { recipient: to, amount, fid: Number(user.fid), nonce },
    });

    // Store intent pending
    const draft = await OnchainMint.findOneAndUpdate(
      { fid: user.fid, reason: 'first_claim' },
      { $setOnInsert: { toAddress: to, amountTokens: CLAIM_AMOUNT, status: 'pending' } },
      { new: true, upsert: true }
    );

    // Build tx payload for Warpcast transaction sheet
    const tx = await formatClaimTransaction({
      to,
      amount,
      decimals,
      fid: user.fid,
      nonce,
      signature,
      claimContract: CLAIM_CONTRACT,
    });

    return res.status(200).json({ tx, metadata: { reason: 'first_claim', fid: user.fid, to } });
  } catch (e) {
    console.error('claim-tx error', e);
    return res.status(500).json({ error: 'Server error', detail: e?.message || 'unknown' });
  }
}


