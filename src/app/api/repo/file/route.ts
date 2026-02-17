import { NextRequest, NextResponse } from 'next/server';
import { getFileContent } from '@/lib/github';
import { getCached, setCache, CACHE_TTL } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const path = searchParams.get('path');
  const branch = searchParams.get('branch') || 'main';

  if (!owner || !repo || !path) {
    return NextResponse.json({ error: 'Missing owner, repo, or path parameter' }, { status: 400 });
  }

  try {
    const cacheKey = `file:${owner}/${repo}:${branch}:${path}`;
    let result = getCached<{ content: string; size: number; sha: string }>(cacheKey);
    if (!result) {
      result = await getFileContent(owner, repo, path, branch);
      setCache(cacheKey, result, CACHE_TTL.FILE);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('File error:', error);
    return NextResponse.json({ error: 'Failed to fetch file content' }, { status: 500 });
  }
}
