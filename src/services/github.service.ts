const GITHUB_API_URL = 'https://api.github.com';

class GithubService {
    headers = {
        'X-GitHub-Api-Version': '2026-03-10',
        'User-Agent': 'GitHub-Repo-Subscription-App-by-boykovm',
        ...(
            process.env.GITHUB_TOKEN ? {
                'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
            } : {}
        ),
    }
    isAuth = !!process.env.GITHUB_TOKEN
    remainingLimit = this.isAuth ? 5000 : 60
    resetTime: number  = 0

    // todo: add cache

    constructor() {}

    async isRepoExists(owner: string, repo: string) {
        if (!this.isRequestAvailable()) {
            throw new Error('Rate limit exceeded')
        }

        this.removeRequest()

        try {
            const { status, headers } = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}`, {
                method: 'GET',
                headers: this.headers
            })

            this.updateLimit(headers)

            return status === 200
        } catch (error) {
            return false;
        }
    }

    async getReleaseTagByRepo(repo: string) {
        if (!this.isRequestAvailable()) {
            throw new Error('Rate limit exceeded')
        }

        this.removeRequest()

        try {
            const response = await fetch(`${GITHUB_API_URL}/repos/${repo}/releases/latest`, {
                method: 'GET',
                headers: this.headers
                    // 'Accept': 'application/vnd.github+json'
            })

            if (response.status === 404) {
                return ''
            }

            this.updateLimit(response.headers)


            const { tag_name = '' } = await response.json()

            return tag_name as string
        } catch (error) {
            return ''
        }
    }

    async getUpdatedTag(data: Array<Record<'repo' | 'last_seen_tag', string>>) {
        // todo: add rate limiter handler

        const promises = data.map(async (item) => {
            const tag = await this.getReleaseTagByRepo(item.repo);

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

    isRequestAvailable() {
        if (this.remainingLimit > 0 || !this.resetTime) {
            return true
        }

        const currentTime = Date.now() / 1000

        return currentTime > this.resetTime
    }

    updateLimit(headers: Headers) {
        this.remainingLimit = Number.parseInt(headers.get('X-RateLimit-Remaining') || '')
        this.resetTime = Number.parseInt(headers.get('X-RateLimit-Reset') || '')
    }

    removeRequest() {
        this.remainingLimit -= 1
    }
}

export const githubService = new GithubService();
