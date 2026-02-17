import { NextRequest, NextResponse } from 'next/server';
import { getRepoTree } from '@/lib/github';
import { getCached, setCache, CACHE_TTL } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const branch = searchParams.get('branch') || 'main';

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Missing owner or repo parameter' }, { status: 400 });
  }

  try {
    const cacheKey = `tree:${owner}/${repo}:${branch}`;
    let tree = getCached<unknown[]>(cacheKey);
    if (!tree) {
      tree = await getRepoTree(owner, repo, branch);
      setCache(cacheKey, tree, CACHE_TTL.TREE);
    }

    return NextResponse.json({ tree });
  } catch (error) {
    console.error('Tree error:', error);
    return NextResponse.json({ error: 'Failed to fetch repo tree' }, { status: 500 });
  }
}
