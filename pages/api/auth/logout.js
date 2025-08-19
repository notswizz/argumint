export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Clear the auth cookie. Send two variants to cover both Secure/SameSite=None and default cookies
  const expiredCookieBase = 'token=; HttpOnly; Path=/; Max-Age=0';
  const headers = [
    `${expiredCookieBase}; SameSite=Lax`,
    `${expiredCookieBase}; SameSite=None; Secure`,
  ];

  res.setHeader('Set-Cookie', headers);
  return res.status(200).json({ ok: true });
}


