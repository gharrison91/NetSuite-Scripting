import { NextRequest, NextResponse } from 'next/server';
import { validateRepo, getRepoTree } from '@/lib/github';
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
    const validation = await validateRepo(owner, repo);
    if (!validation.valid) {
      return NextResponse.json({ valid: false, error: validation.error }, { status: 404 });
    }

    // Check repo structure
    const cacheKey = `tree:${owner}/${repo}:${branch}`;
    let tree = getCached<{ path?: string; type?: string }[]>(cacheKey);
    if (!tree) {
      tree = await getRepoTree(owner, repo, branch);
      setCache(cacheKey, tree, CACHE_TTL.TREE);
    }

    const expectedFolders = ['scripts', 'modules', 'dashboards', 'reference', 'standards', 'maps', '_inbox'];
    const topLevelDirs = new Set(
      tree
        .filter((item) => item.type === 'tree' && item.path && !item.path.includes('/'))
        .map((item) => item.path)
    );
    const foundFolders = expectedFolders.filter((f) => topLevelDirs.has(f));
    const missingFolders = expectedFolders.filter((f) => !topLevelDirs.has(f));

    const hasExpectedStructure = foundFolders.length >= 3;

    return NextResponse.json({
      valid: true,
      hasExpectedStructure,
      foundFolders,
      missingFolders,
      repoInfo: {
        fullName: validation.data?.full_name,
        description: validation.data?.description,
        private: validation.data?.private,
        defaultBranch: validation.data?.default_branch,
      },
    });
  } catch (error) {
    console.error('Validate error:', error);
    return NextResponse.json(
      { error: 'Failed to validate repository' },
      { status: 500 }
    );
  }
}
