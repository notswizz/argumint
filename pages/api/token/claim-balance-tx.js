import { z } from 'zod';
import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { formatClaimTransaction } from '@/lib/claim';
import OnchainMint from '@/models/OnchainMint';
import { getTokenDecimals } from '@/lib/chain';
import { createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const user = await getUserFromRequest(req);
    if (!user?.fid) return res.status(401).json({ error: 'Unauthorized' });
    await connectToDatabase();

    const CLAIM_CONTRACT = process.env.ARG_CLAIM_CONTRACT_ADDRESS;
    const signerPk = process.env.CLAIM_SIGNER_PRIVATE_KEY;
    if (!CLAIM_CONTRACT || !signerPk) return res.status(500).json({ error: 'Server missing claim configuration' });

    // Off-chain mirror balance (integer tokens)
    const offchain = Number(user.tokens || 0);
    if (!Number.isFinite(offchain) || offchain <= 0) return res.status(400).json({ error: 'No balance to claim' });

    // Use FID as identity; nonce = current count of claims for this fid
    const claimsCount = await OnchainMint.countDocuments({ fid: user.fid });
    const nonce = claimsCount; // 0-based monotonic

    const account = privateKeyToAccount(signerPk.startsWith('0x') ? signerPk : `0x${signerPk}`);
    const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(process.env.BASE_RPC_URL || 'https://sepolia.base.org') });

    const decimals = await getTokenDecimals();
    const amount = parseUnits(String(offchain), decimals);
    const to = (user.custodyAddress || '').toLowerCase();
    if (!to) return res.status(400).json({ error: 'No custody address linked' });

    // Sign EIP-712 authorization
    const signature = await wallet.signTypedData({
      domain: { name: 'ArgumintClaim', version: '1', chainId: baseSepolia.id, verifyingContract: CLAIM_CONTRACT },
      types: { Claim: [
        { name: 'recipient', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'fid', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ]},
      primaryType: 'Claim',
      message: { recipient: to, amount, fid: Number(user.fid), nonce },
    });

    const tx = await formatClaimTransaction({ to, amount, decimals, fid: user.fid, nonce, signature, claimContract: CLAIM_CONTRACT });

    // Record intent with this nonce
    await OnchainMint.create({ fid: user.fid, toAddress: to, amountTokens: offchain, nonce, reason: 'first_claim', status: 'pending' });

    return res.status(200).json({ tx, meta: { nonce } });
  } catch (e) {
    console.error('claim-balance-tx error', e);
    return res.status(500).json({ error: 'Server error', detail: e?.message || 'unknown' });
  }
}


