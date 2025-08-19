import { createPublicClient, createWalletClient, http, parseAbi, parseUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Minimal ABI for the required methods/events
export const tokenAbi = parseAbi([
  'function mint(address to, uint256 amount) external',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function symbol() view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
]);

const RPC_URL = process.env.BASE_RPC_URL;
if (!RPC_URL) {
  // Do not throw on import; API routes can validate and return helpful errors
  console.warn('BASE_RPC_URL is not set. Onchain features will be disabled until configured.');
}

export const TOKEN_ADDRESS = (process.env.ARG_TOKEN_ADDRESS || '').toLowerCase();

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL || 'https://sepolia.base.org')
});

let walletClient = null;
export function getWalletClient() {
  if (walletClient) return walletClient;
  const pk = process.env.MINTER_PRIVATE_KEY;
  if (!pk) return null;
  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
  walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC_URL || 'https://sepolia.base.org') });
  return walletClient;
}

let cachedDecimals = null;
export async function getTokenDecimals() {
  if (cachedDecimals != null) return cachedDecimals;
  try {
    const decimals = await publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: tokenAbi,
      functionName: 'decimals'
    });
    cachedDecimals = Number(decimals) || 18;
  } catch {
    cachedDecimals = Number(process.env.ARG_TOKEN_DECIMALS || 18);
  }
  return cachedDecimals;
}

export async function mintToAddress({ to, amountTokens }) {
  if (!TOKEN_ADDRESS) throw new Error('ARG_TOKEN_ADDRESS not configured');
  const client = getWalletClient();
  if (!client) throw new Error('MINTER_PRIVATE_KEY not configured');
  if (!to) throw new Error('Missing recipient address');
  const decimals = await getTokenDecimals();
  const amount = parseUnits(String(amountTokens), decimals);
  const hash = await client.writeContract({
    address: TOKEN_ADDRESS,
    abi: tokenAbi,
    functionName: 'mint',
    args: [to, amount]
  });
  return { hash };
}


