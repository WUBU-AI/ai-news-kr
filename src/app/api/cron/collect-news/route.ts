import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: Phase 1 — RSS 수집 로직 구현 (WUBA-2425)
  return NextResponse.json({ message: 'Cron job placeholder — implement in WUBA-2425' });
}
