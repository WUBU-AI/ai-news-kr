import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Google Search Console verification: /api/google-site-verification
// responds with "google-site-verification: <code>"
export async function GET() {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'google_search_console_code' },
    });
    if (!setting?.value) {
      return new NextResponse('Not found', { status: 404 });
    }
    return new NextResponse(setting.value, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
