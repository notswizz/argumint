import { tokenAbi, TOKEN_ADDRESS } from '@/lib/chain';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { getUserFromRequest } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { getCustodyAddressByFid } from '@/lib/farcaster';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    // Always query balances on Base Sepolia for display
    const displayClient = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.BASE_RPC_URL || 'https://sepolia.base.org')
    });
    // Allow explicit wallet address via query/header for Mini App
    let overrideAddress = req.query.address || req.headers['x-address'];
    if (overrideAddress && typeof overrideAddress === 'string') {
      overrideAddress = overrideAddress.trim();
    } else {
      overrideAddress = undefined;
    }

    let user = await getUserFromRequest(req);
    // Fallback: accept fid via header for Mini App sandbox where cookies may be blocked
    if ((!user || !user.fid) && req.headers['x-fid']) {
      const fid = Number(req.headers['x-fid']);
      if (Number.isFinite(fid)) {
        await connectToDatabase();
        user = await User.findOne({ fid });
      }
    }
    if (!user && !overrideAddress) return res.status(401).json({ error: 'Unauthorized' });
    let address = overrideAddress || (user ? user.custodyAddress : '');
    if (!address) {
      try { address = await getCustodyAddressByFid(user.fid); } catch {}
    }
    if (!address) return res.status(400).json({ error: 'No custody address for this user' });
    const [balance, decimals, symbol] = await Promise.all([
      displayClient.readContract({ address: TOKEN_ADDRESS, abi: tokenAbi, functionName: 'balanceOf', args: [address] }),
      displayClient.readContract({ address: TOKEN_ADDRESS, abi: tokenAbi, functionName: 'decimals' }),
      displayClient.readContract({ address: TOKEN_ADDRESS, abi: tokenAbi, functionName: 'symbol' }).catch(() => 'TOKEN'),
    ]);
    return res.status(200).json({ address, balance: balance?.toString?.() || '0', decimals: Number(decimals) || 18, symbol });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: e?.message || 'unknown' });
  }
}


