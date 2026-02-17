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

export async function listUserRepos(username: string) {
  const octokit = getOctokit();

  // Try authenticated endpoint first — this includes private repos
  try {
    const { data } = await octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: 'updated',
      affiliation: 'owner,collaborator,organization_member',
    });
    // Filter to repos owned by the requested username
    const filtered = data.filter(
      (r) => r.owner.login.toLowerCase() === username.toLowerCase()
    );
    if (filtered.length > 0) {
      return filtered.map((r) => ({
        name: r.name,
        description: r.description,
        private: r.private,
      }));
    }
  } catch {
    // Token may not have user scope — fall back to public endpoint
  }

  // Fallback: public repos only
  const { data } = await octokit.repos.listForUser({
    username,
    per_page: 100,
    sort: 'updated',
  });
  return data.map((r) => ({
    name: r.name,
    description: r.description,
    private: r.private,
  }));
}

export async function checkTokenHealth(owner?: string, repo?: string) {
  const token = process.env.GITHUB_TOKEN;
  const result: {
    tokenPresent: boolean;
    tokenValid: boolean;
    authenticatedUser: string | null;
    tokenScopes: string[];
    rateLimit: { remaining: number; limit: number; resetAt: string } | null;
    repoAccess?: { canAccess: boolean; isPrivate: boolean; error?: string };
  } = {
    tokenPresent: false,
    tokenValid: false,
    authenticatedUser: null,
    tokenScopes: [],
    rateLimit: null,
  };

  if (!token || token === 'your_github_token_here') {
    return result;
  }
  result.tokenPresent = true;

  const octokit = getOctokit();

  // Check token validity and get authenticated user
  try {
    const authResponse = await octokit.users.getAuthenticated();
    result.tokenValid = true;
    result.authenticatedUser = authResponse.data.login;

    // Extract scopes from response headers
    const scopes = authResponse.headers['x-oauth-scopes'];
    if (scopes && typeof scopes === 'string') {
      result.tokenScopes = scopes.split(',').map((s) => s.trim()).filter(Boolean);
    }
  } catch {
    // Token is invalid or doesn't have user scope
    // Still try rate limit to see if token works at all
  }

  // Check rate limit
  try {
    const rateData = await getRateLimit();
    result.rateLimit = rateData;
  } catch {
    // ignore
  }

  // Test specific repo access if provided
  if (owner && repo) {
    try {
      const validation = await validateRepo(owner, repo);
      if (validation.valid) {
        result.repoAccess = {
          canAccess: true,
          isPrivate: validation.data?.private ?? false,
        };
      } else {
        result.repoAccess = {
          canAccess: false,
          isPrivate: false,
          error: validation.error,
        };
      }
    } catch {
      result.repoAccess = {
        canAccess: false,
        isPrivate: false,
        error: 'Unexpected error accessing repository',
      };
    }
  }

  return result;
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
