import { NextRequest, NextResponse } from 'next/server';
import { listUserRepos } from '@/lib/github';
import { getCached, setCache, CACHE_TTL } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const owner = searchParams.get('owner');

  if (!owner) {
    return NextResponse.json({ error: 'Missing owner parameter' }, { status: 400 });
  }

  try {
    const cacheKey = `repos:${owner}`;
    let repos = getCached<{ name: string; description: string | null; private: boolean }[]>(cacheKey);
    if (!repos) {
      repos = await listUserRepos(owner);
      setCache(cacheKey, repos, CACHE_TTL.REPOS);
    }

    return NextResponse.json({ repos });
  } catch (error) {
    console.error('Repos error:', error);
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 });
  }
}
