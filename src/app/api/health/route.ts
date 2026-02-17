import { NextRequest, NextResponse } from 'next/server';
import { checkTokenHealth } from '@/lib/github';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const owner = searchParams.get('owner') || undefined;
  const repo = searchParams.get('repo') || undefined;

  try {
    const health = await checkTokenHealth(owner, repo);
    return NextResponse.json(health);
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { error: 'Health check failed unexpectedly' },
      { status: 500 }
    );
  }
}
