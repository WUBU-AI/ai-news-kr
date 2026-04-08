import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Handles Google Search Console verification file: /google[code].html
export async function GET(
  _request: NextRequest,
  { params }: { params: { gscVerification: string } }
) {
  const slug = params.gscVerification;

  // Only handle googleXXXXX.html patterns
  if (!slug.startsWith('google') || !slug.endsWith('.html')) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'google_search_console_code' },
    });
    if (!setting?.value) {
      return new NextResponse('Not found', { status: 404 });
    }

    // GSC verification file format: "google-site-verification: XXXXX"
    return new NextResponse(setting.value, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
