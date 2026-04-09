const GITHUB_API_URL = 'https://api.github.com';

const headers = {
    'X-GitHub-Api-Version': '2026-03-10',
    'User-Agent': 'GitHub-Repo-Subscription-App-by-boykovm',
    ...(
      process.env.GITHUB_TOKEN ? {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
      } : {}
    ),
}

export const isRepoExists = async (owner: string, repo: string) => {
    try {
        const { status } = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}`, {
            method: 'GET',
            headers
        })

        return status === 200
    } catch (error) {
        return false;
    }
}
