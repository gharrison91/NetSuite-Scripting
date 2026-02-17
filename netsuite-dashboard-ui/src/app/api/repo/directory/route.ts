import { NextRequest, NextResponse } from 'next/server';
import { getDirectoryContents } from '@/lib/github';

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
    const contents = await getDirectoryContents(owner, repo, path, branch);
    return NextResponse.json({ contents });
  } catch (error) {
    console.error('Directory error:', error);
    return NextResponse.json({ error: 'Failed to fetch directory contents' }, { status: 500 });
  }
}
