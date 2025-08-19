import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const {
  OWNER_PRIVATE_KEY,           // private key of CURRENT token owner (0x...64)
  TOKEN_ADDRESS,               // 0xb1e37230c38b9e5719715af7f75922a2458f0edb
  CLAIM_CONTRACT_ADDRESS,      // your deployed ArgumintClaim address
  BASE_RPC_URL = 'https://sepolia.base.org',
} = process.env;

if (!OWNER_PRIVATE_KEY || !TOKEN_ADDRESS || !CLAIM_CONTRACT_ADDRESS) {
  throw new Error('Missing env: OWNER_PRIVATE_KEY, TOKEN_ADDRESS, CLAIM_CONTRACT_ADDRESS');
}

const ownerPk = OWNER_PRIVATE_KEY.startsWith('0x') ? OWNER_PRIVATE_KEY : `0x${OWNER_PRIVATE_KEY}`;
const account = privateKeyToAccount(ownerPk);

const publicClient = createPublicClient({ chain: baseSepolia, transport: http(BASE_RPC_URL) });
const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(BASE_RPC_URL) });

const abi = parseAbi([
  'function owner() view returns (address)',
  'function transferOwnership(address newOwner)',
]);

async function main() {
  const token = TOKEN_ADDRESS;
  const claim = CLAIM_CONTRACT_ADDRESS;

  const before = await publicClient.readContract({ address: token, abi, functionName: 'owner' });
  console.log('Current owner:', before);

  if (before.toLowerCase() === claim.toLowerCase()) {
    console.log('Ownership already set to claim contract. Nothing to do.');
    return;
  }

  const hash = await walletClient.writeContract({
    address: token,
    abi,
    functionName: 'transferOwnership',
    args: [claim],
  });
  console.log('Submitted tx:', hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Mined in block:', receipt.blockNumber);

  const after = await publicClient.readContract({ address: token, abi, functionName: 'owner' });
  console.log('New owner:', after);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});