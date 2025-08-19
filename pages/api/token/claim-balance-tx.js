import { z } from 'zod';
import { connectToDatabase } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { formatClaimTransaction } from '@/lib/claim';
import OnchainMint from '@/models/OnchainMint';
import { getTokenDecimals } from '@/lib/chain';
import { createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { connectToDatabase as connect } from '@/lib/db';
import User from '@/models/User';
import { getCustodyAddressByFid } from '@/lib/farcaster';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    // Allow explicit wallet address via header for Mini App
    let explicitAddress = req.headers['x-address'] ? String(req.headers['x-address']).trim() : '';

    let user = await getUserFromRequest(req);
    // Accept fid from header in sandboxed Mini App
    if ((!user || !user.fid) && req.headers['x-fid']) {
      const fid = Number(req.headers['x-fid']);
      if (Number.isFinite(fid)) {
        await connect();
        user = await User.findOne({ fid });
      }
    }
    if (!user?.fid && !explicitAddress) return res.status(401).json({ error: 'Unauthorized' });
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

    const CHAIN_ID = Number(process.env.CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || 84532);
    const CHAIN = CHAIN_ID === 8453 ? base : baseSepolia;
    const account = privateKeyToAccount(signerPk.startsWith('0x') ? signerPk : `0x${signerPk}`);
    const wallet = createWalletClient({ account, chain: CHAIN, transport: http(process.env.BASE_RPC_URL || (CHAIN_ID === 8453 ? 'https://mainnet.base.org' : 'https://sepolia.base.org')) });

    const decimals = await getTokenDecimals();
    const amount = parseUnits(String(offchain), decimals);
    let to = (explicitAddress || user?.custodyAddress || '').toLowerCase();
    if (!to) {
      try { to = await getCustodyAddressByFid(user.fid); } catch {}
    }
    if (!to) return res.status(400).json({ error: 'No custody address linked' });

    // Sign EIP-712 authorization
    const signature = await wallet.signTypedData({
      domain: { name: 'ArgumintClaim', version: '1', chainId: CHAIN.id, verifyingContract: CLAIM_CONTRACT },
      types: { Claim: [
        { name: 'recipient', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'fid', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ]},
      primaryType: 'Claim',
      message: { recipient: to, amount, fid: Number(user?.fid || 0), nonce },
    });

    const tx = await formatClaimTransaction({ to, amount, decimals, fid: user.fid, nonce, signature, claimContract: CLAIM_CONTRACT });

    // Record intent with this nonce
    await OnchainMint.create({ fid: user?.fid || 0, toAddress: to, amountTokens: offchain, nonce, reason: 'first_claim', status: 'pending' });

    return res.status(200).json({ tx, meta: { nonce } });
  } catch (e) {
    console.error('claim-balance-tx error', e);
    return res.status(500).json({ error: 'Server error', detail: e?.message || 'unknown' });
  }
}


