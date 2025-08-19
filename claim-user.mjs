import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import claimAbiModule from './lib/claim-abi.js';

const {
  BASE_RPC_URL = 'https://sepolia.base.org',
  // Contract + signer that authorizes claims
  ARG_CLAIM_CONTRACT_ADDRESS,
  CLAIM_SIGNER_PRIVATE_KEY,
  // The user wallet (payer) that will submit the tx
  USER_PRIVATE_KEY,
  // Claim parameters
  RECIPIENT,            // address that will receive tokens (often same as user wallet)
  FID,                  // user's Farcaster fid (number)
  NONCE = '0',          // claim nonce (e.g., 0 for first-claim)
  AMOUNT_TOKENS = '100',// human amount (e.g., 100)
  DECIMALS = '18',
} = process.env;

if (!ARG_CLAIM_CONTRACT_ADDRESS) throw new Error('Missing ARG_CLAIM_CONTRACT_ADDRESS');
if (!CLAIM_SIGNER_PRIVATE_KEY) throw new Error('Missing CLAIM_SIGNER_PRIVATE_KEY');
if (!USER_PRIVATE_KEY) throw new Error('Missing USER_PRIVATE_KEY');
if (!RECIPIENT) throw new Error('Missing RECIPIENT');
if (!FID) throw new Error('Missing FID');

const publicClient = createPublicClient({ chain: baseSepolia, transport: http(BASE_RPC_URL) });
const claimAbi = (claimAbiModule && (claimAbiModule.claimAbi || claimAbiModule.default)) || claimAbiModule;

function to0x(pk) { return pk.startsWith('0x') ? pk : `0x${pk}`; }

async function main() {
  const signerAccount = privateKeyToAccount(to0x(CLAIM_SIGNER_PRIVATE_KEY));
  const userAccount = privateKeyToAccount(to0x(USER_PRIVATE_KEY));

  const signer = createWalletClient({ account: signerAccount, chain: baseSepolia, transport: http(BASE_RPC_URL) });
  const user = createWalletClient({ account: userAccount, chain: baseSepolia, transport: http(BASE_RPC_URL) });

  const fid = Number(FID);
  const nonce = Number(NONCE);
  const amount = parseUnits(String(AMOUNT_TOKENS), Number(DECIMALS));
  const claimAddress = ARG_CLAIM_CONTRACT_ADDRESS;

  // EIP-712 signature by server signer
  const signature = await signer.signTypedData({
    domain: { name: 'ArgumintClaim', version: '1', chainId: baseSepolia.id, verifyingContract: claimAddress },
    types: {
      Claim: [
        { name: 'recipient', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'fid', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    primaryType: 'Claim',
    message: { recipient: RECIPIENT, amount, fid, nonce },
  });

  console.log('Signature:', signature);

  // Submit claim from the user wallet
  const hash = await user.writeContract({
    address: claimAddress,
    abi: claimAbi,
    functionName: 'claim',
    args: [RECIPIENT, amount, BigInt(fid), BigInt(nonce), signature],
  });
  console.log('Submitted tx:', hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Mined in block:', receipt.blockNumber);
}

main().catch((e) => { console.error(e); process.exit(1); });


