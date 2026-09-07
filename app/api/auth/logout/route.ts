import { NextResponse } from 'next/server';
import { clearSessionCookie, revokeCurrentSession } from '@/lib/auth/session';

export async function POST() {
  await revokeCurrentSession();
  clearSessionCookie();
  return NextResponse.json({ success: true });
}
