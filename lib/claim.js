import { createPublicClient, http, encodeFunctionData, parseUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import { claimAbi } from './claim-abi';
import { tokenAbi } from './chain';

const RPC_URL = process.env.BASE_RPC_URL;
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL || 'https://sepolia.base.org') });

export function buildClaimCalldata({ to, amountTokens, fid, nonce, signature, claimContract }) {
  if (!to) throw new Error('Missing recipient');
  if (!claimContract) throw new Error('Missing claim contract address');
  if (amountTokens == null) throw new Error('Missing amount');
  const data = encodeFunctionData({
    abi: claimAbi,
    functionName: 'claim',
    args: [to, amountTokens, BigInt(fid), BigInt(nonce), signature]
  });
  return data;
}

export async function formatClaimTransaction({ to, amount, decimals = 18, fid, nonce, signature, claimContract }) {
  const amountWei = typeof amount === 'bigint' ? amount : parseUnits(String(amount), decimals);
  const data = buildClaimCalldata({ to, amountTokens: amountWei, fid, nonce, signature, claimContract });
  return {
    to: claimContract,
    data,
    value: '0x0'
  };
}


