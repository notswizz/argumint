import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '@/models/User';
import { connectToDatabase } from './db';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET environment variable');
}

export async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyJwt(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

export async function getUserFromRequest(req) {
  await connectToDatabase();
  const token = req.cookies?.token || null;
  if (!token) return null;
  const decoded = verifyJwt(token);
  if (!decoded?._id) return null;
  const user = await User.findById(decoded._id).lean();
  return user || null;
} 