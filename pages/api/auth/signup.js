import { z } from 'zod';
import { connectToDatabase } from '@/lib/db';
import User from '@/models/User';
import { hashPassword, signJwt } from '@/lib/auth';

const SignupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32),
  password: z.string().min(6),
  acceptTerms: z.boolean(),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { email, username, password, acceptTerms } = parsed.data;
  if (!acceptTerms) return res.status(400).json({ error: 'Terms must be accepted' });
  await connectToDatabase();
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const passwordHash = await hashPassword(password);
  const user = await User.create({ email, username, passwordHash, acceptedTermsAt: new Date() });
  const token = signJwt({ _id: user._id, email: user.email });
  res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`);
  return res.status(201).json({ user: { _id: user._id, email, username, tokens: user.tokens } });
} 