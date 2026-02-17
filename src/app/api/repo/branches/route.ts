import { NextRequest, NextResponse } from 'next/server';
import { getBranches } from '@/lib/github';
import { getCached, setCache, CACHE_TTL } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Missing owner or repo parameter' }, { status: 400 });
  }

  try {
    const cacheKey = `branches:${owner}/${repo}`;
    let branches = getCached<string[]>(cacheKey);
    if (!branches) {
      branches = await getBranches(owner, repo);
      setCache(cacheKey, branches, CACHE_TTL.BRANCHES);
    }

    return NextResponse.json({ branches });
  } catch (error) {
    console.error('Branches error:', error);
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
  }
}
