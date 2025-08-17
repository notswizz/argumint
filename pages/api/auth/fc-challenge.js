export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const nonce = Math.random().toString(36).slice(2) + Date.now();
  const message = `ArguMint login\n\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`;
  return res.status(200).json({ message });
}


