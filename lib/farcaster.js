import { NeynarAPIClient } from '@neynar/nodejs-sdk';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || '';
let client = null;

function getClient() {
  if (!client) client = new NeynarAPIClient(NEYNAR_API_KEY || '');
  return client;
}

export async function getCustodyAddressByFid(fid) {
  if (!NEYNAR_API_KEY) throw new Error('NEYNAR_API_KEY not configured');
  const api = getClient();
  const res = await api.fetchUsers([Number(fid)], { viewerFid: Number(fid) }).catch(() => null);
  const user = res && Array.isArray(res.users) ? res.users[0] : null;
  const custody = user?.custody_address || user?.verified_addresses?.eth_addresses?.[0] || null;
  return custody ? String(custody).toLowerCase() : null;
}


