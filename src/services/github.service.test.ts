
import { githubService } from './github.service';
import { beforeEach, describe, expect, it, jest, afterEach } from '@jest/globals';

describe('GithubService', () => {
  let fetchSpy: jest.Spied<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch') as jest.Spied<typeof fetch>;
    // Reset singleton state
    githubService.remainingLimit = 60;
    githubService.resetTime = 0;
    githubService.isAuth = false;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isRequestAvailable', () => {
    it('should return true if remainingLimit > 0', () => {
      githubService.remainingLimit = 10;
      expect(githubService.isRequestAvailable()).toBe(true);
    });

    it('should return true if resetTime is 0', () => {
      githubService.remainingLimit = 0;
      githubService.resetTime = 0;
      expect(githubService.isRequestAvailable()).toBe(true);
    });

    it('should return true if currentTime > resetTime', () => {
      githubService.remainingLimit = 0;
      githubService.resetTime = Math.floor(Date.now() / 1000) - 10;
      expect(githubService.isRequestAvailable()).toBe(true);
    });

    it('should return false if remainingLimit <= 0 and currentTime <= resetTime', () => {
      githubService.remainingLimit = 0;
      githubService.resetTime = Math.floor(Date.now() / 1000) + 1000;
      expect(githubService.isRequestAvailable()).toBe(false);
    });
  });

  describe('updateLimit', () => {
    it('should update remainingLimit and resetTime from headers', () => {
      const headers = new Headers({
        'X-RateLimit-Remaining': '4500',
        'X-RateLimit-Reset': '1234567890'
      });

      githubService.updateLimit(headers);

      expect(githubService.remainingLimit).toBe(4500);
      expect(githubService.resetTime).toBe(1234567890);
    });

    it('should handle missing headers by setting to NaN', () => {
        const headers = new Headers();
        githubService.updateLimit(headers);
        expect(githubService.remainingLimit).toBeNaN();
        expect(githubService.resetTime).toBeNaN();
    });
  });

  describe('removeRequest', () => {
    it('should decrement remainingLimit', () => {
      githubService.remainingLimit = 100;
      githubService.removeRequest();
      expect(githubService.remainingLimit).toBe(99);
    });
  });

  describe('isRepoExists', () => {
    it('should return true when status is 200', async () => {
      fetchSpy.mockResolvedValue({
        status: 200,
        headers: new Headers({
            'X-RateLimit-Remaining': '59',
            'X-RateLimit-Reset': '1234567890'
        })
      } as Response);

      const result = await githubService.isRepoExists('owner', 'repo');

      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo',
        expect.objectContaining({ method: 'GET' })
      );
      expect(githubService.remainingLimit).toBe(59);
    });

    it('should pass headers in the request', async () => {
      fetchSpy.mockResolvedValue({
        status: 200,
        headers: new Headers()
      } as Response);

      const originalHeaders = githubService.headers;
      githubService.headers = { 'X-Test': 'test-value' } as any;

      await githubService.isRepoExists('owner', 'repo');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { 'X-Test': 'test-value' }
        })
      );
      githubService.headers = originalHeaders;
    });

    it('should return false when status is not 200', async () => {
      fetchSpy.mockResolvedValue({
        status: 404,
        headers: new Headers({
            'X-RateLimit-Remaining': '59',
            'X-RateLimit-Reset': '1234567890'
        })
      } as Response);

      const result = await githubService.isRepoExists('owner', 'repo');

      expect(result).toBe(false);
      expect(githubService.remainingLimit).toBe(59);
    });

    it('should return false when fetch throws error', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));

      const result = await githubService.isRepoExists('owner', 'repo');

      expect(result).toBe(false);
    });

    it('should throw "Rate limit exceeded" when request is not available', async () => {
      githubService.remainingLimit = 0;
      githubService.resetTime = Math.floor(Date.now() / 1000) + 1000;

      await expect(githubService.isRepoExists('owner', 'repo')).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('getReleaseTagByRepo', () => {
    it('should return tag_name from response', async () => {
      fetchSpy.mockResolvedValue({
        status: 200,
        headers: new Headers({
            'X-RateLimit-Remaining': '58',
            'X-RateLimit-Reset': '1234567890'
        }),
        json: async () => ({ tag_name: 'v1.2.3' })
      } as Response);

      const result = await githubService.getReleaseTagByRepo('owner/repo');

      expect(result).toBe('v1.2.3');
      expect(githubService.remainingLimit).toBe(58);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/releases/latest',
        expect.objectContaining({ headers: githubService.headers })
      );
    });

    it('should return empty string when status is 404', async () => {
      fetchSpy.mockResolvedValue({
        status: 404,
        headers: new Headers()
      } as Response);

      const result = await githubService.getReleaseTagByRepo('owner/repo');

      expect(result).toBe('');
    });

    it('should return empty string when fetch throws error', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));

      const result = await githubService.getReleaseTagByRepo('owner/repo');

      expect(result).toBe('');
    });

    it('should throw "Rate limit exceeded" when request is not available', async () => {
        githubService.remainingLimit = 0;
        githubService.resetTime = Math.floor(Date.now() / 1000) + 1000;
  
        await expect(githubService.getReleaseTagByRepo('owner/repo')).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('getUpdatedTag', () => {
    it('should return updated tags only', async () => {
        fetchSpy.mockResolvedValueOnce({
            status: 200,
            headers: new Headers(),
            json: async () => ({ tag_name: 'v2.0.0' })
        } as Response) // For repo1
        .mockResolvedValueOnce({
            status: 200,
            headers: new Headers(),
            json: async () => ({ tag_name: 'v1.0.0' })
        } as Response); // For repo2

        const data = [
            { repo: 'owner/repo1', last_seen_tag: 'v1.0.0' },
            { repo: 'owner/repo2', last_seen_tag: 'v1.0.0' }
        ];

        const result = await githubService.getUpdatedTag(data);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            repo: 'owner/repo1',
            last_seen_tag: 'v1.0.0',
            newTag: 'v2.0.0'
        });
    });

    it('should return empty array when no tags are updated', async () => {
        fetchSpy.mockResolvedValue({
            status: 200,
            headers: new Headers(),
            json: async () => ({ tag_name: 'v1.0.0' })
        } as Response);

        const data = [
            { repo: 'owner/repo1', last_seen_tag: 'v1.0.0' }
        ];

        const result = await githubService.getUpdatedTag(data);

        expect(result).toHaveLength(0);
    });

    it('should throw if any call to getReleaseTagByRepo fails with an error', async () => {
        githubService.remainingLimit = 1; // Only enough for one call
        githubService.resetTime = Math.floor(Date.now() / 1000) + 1000;

        fetchSpy.mockResolvedValueOnce({
            status: 200,
            headers: new Headers(),
            json: async () => ({ tag_name: 'v2.0.0' })
        } as Response);

        const data = [
            { repo: 'owner/repo1', last_seen_tag: 'v1.0.0' },
            { repo: 'owner/repo2', last_seen_tag: 'v1.0.0' }
        ];

        await expect(githubService.getUpdatedTag(data)).rejects.toThrow('Rate limit exceeded');
    });
  });
});
