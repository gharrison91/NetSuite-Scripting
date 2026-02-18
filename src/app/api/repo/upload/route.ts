import { NextRequest, NextResponse } from 'next/server';
import { getOctokit } from '@/lib/github';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, branch, path, content, message } = body;

    if (!owner || !repo || !branch || !path || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: owner, repo, branch, path, content' },
        { status: 400 }
      );
    }

    const octokit = getOctokit();

    // Check if file already exists (to get its SHA for updates)
    let existingSha: string | undefined;
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });
      if (!Array.isArray(data) && data.type === 'file') {
        existingSha = data.sha;
      }
    } catch {
      // File doesn't exist yet — that's fine
    }

    // Create or update the file
    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: message || `Add ${path.split('/').pop()} via dashboard`,
      content: Buffer.from(content).toString('base64'),
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    });

    return NextResponse.json({
      success: true,
      path: data.content?.path,
      sha: data.content?.sha,
    });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status || 500;
    const msg = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: msg }, { status });
  }
}
