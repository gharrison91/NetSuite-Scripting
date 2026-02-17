import { Octokit } from '@octokit/rest';

let octokitInstance: Octokit | null = null;

export function getOctokit(): Octokit {
  if (!octokitInstance) {
    octokitInstance = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }
  return octokitInstance;
}

export async function validateRepo(owner: string, repo: string) {
  const octokit = getOctokit();
  try {
    const { data } = await octokit.repos.get({ owner, repo });
    return { valid: true, data };
  } catch (error: unknown) {
    const status = (error as { status?: number }).status;
    if (status === 404) {
      return { valid: false, error: 'Repository not found' };
    }
    if (status === 401 || status === 403) {
      return { valid: false, error: 'Authentication required or insufficient permissions' };
    }
    throw error;
  }
}

export async function getRepoTree(owner: string, repo: string, branch: string) {
  const octokit = getOctokit();
  const { data } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: '1',
  });
  return data.tree;
}

export async function getFileContent(owner: string, repo: string, path: string, branch: string) {
  const octokit = getOctokit();
  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path,
    ref: branch,
  });

  if ('content' in data && data.type === 'file') {
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return { content, size: data.size, sha: data.sha };
  }
  throw new Error('Not a file');
}

export async function getDirectoryContents(owner: string, repo: string, path: string, branch: string) {
  const octokit = getOctokit();
  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path,
    ref: branch,
  });

  if (Array.isArray(data)) {
    return data;
  }
  throw new Error('Not a directory');
}

export async function getBranches(owner: string, repo: string) {
  const octokit = getOctokit();
  const { data } = await octokit.repos.listBranches({
    owner,
    repo,
    per_page: 100,
  });
  return data.map((b) => b.name);
}

export async function getRateLimit() {
  const octokit = getOctokit();
  const { data } = await octokit.rateLimit.get();
  return {
    remaining: data.rate.remaining,
    limit: data.rate.limit,
    resetAt: new Date(data.rate.reset * 1000).toISOString(),
  };
}
