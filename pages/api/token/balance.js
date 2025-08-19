import { publicClient, tokenAbi, TOKEN_ADDRESS } from '@/lib/chain';
import { getUserFromRequest } from '@/lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const user = await getUserFromRequest(req);
    if (!user || !user.fid) return res.status(401).json({ error: 'Unauthorized' });
    const address = user.custodyAddress;
    if (!address) return res.status(400).json({ error: 'No custody address for this user' });
    const [balance, decimals, symbol] = await Promise.all([
      publicClient.readContract({ address: TOKEN_ADDRESS, abi: tokenAbi, functionName: 'balanceOf', args: [address] }),
      publicClient.readContract({ address: TOKEN_ADDRESS, abi: tokenAbi, functionName: 'decimals' }),
      publicClient.readContract({ address: TOKEN_ADDRESS, abi: tokenAbi, functionName: 'symbol' }).catch(() => 'TOKEN'),
    ]);
    return res.status(200).json({ address, balance: balance?.toString?.() || '0', decimals: Number(decimals) || 18, symbol });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: e?.message || 'unknown' });
  }
}


