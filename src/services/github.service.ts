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

export const getReleaseTagByRepo = async (repo: string)=> {
    try {
        const response = await fetch(`${GITHUB_API_URL}/repos/${repo}/releases/latest`, {
            method: 'GET',
            headers: {
                ...headers,
                // 'Accept': 'application/vnd.github+json'
            }
        })

        if (response.status === 404) {
            return ''
        }

        const { tag_name = '' } = await response.json()

        return tag_name as string
    } catch (error) {
        return ''
    }
}

// todo: add 429 error handler

export const getUpdatedTag = async (data: Array<Record<'repo' | 'last_seen_tag', string>>) => {
    const promises = data.map(async (item) => {
        const tag = await getReleaseTagByRepo(item.repo);

        if (tag && tag !== item.last_seen_tag) {
            return {
                ...item,
                newTag: tag
            };
        }
        return null;
    });

    const results = await Promise.all(promises);
    return results.filter((item): item is (Record<'repo' | 'last_seen_tag' | 'newTag', string>) => item !== null);
}