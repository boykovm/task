import cron from 'node-cron';
import { beforeEach, describe, expect, it, jest, afterEach } from '@jest/globals';
import { SchedulerService } from './scheduler.service';
import { getAllSubscribedRepos, getEmailsListByRepoAndTagAndUpdateTag } from '../models/subscription';
import { githubService } from './github.service';
import { sendUpdatedEmail } from './email.service';

jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

jest.mock('../models/subscription', () => ({
  getAllSubscribedRepos: jest.fn(),
  getEmailsListByRepoAndTagAndUpdateTag: jest.fn(),
}));

jest.mock('./github.service', () => ({
  githubService: {
    getUpdatedTag: jest.fn(),
  },
}));

jest.mock('./email.service', () => ({
  sendUpdatedEmail: jest.fn(),
}));

const mockGetAllSubscribedRepos = jest.mocked(getAllSubscribedRepos);
const mockGetEmailsListByRepoAndTagAndUpdateTag = jest.mocked(getEmailsListByRepoAndTagAndUpdateTag);
const mockGetUpdatedTag = jest.mocked(githubService.getUpdatedTag);
const mockSendUpdatedEmail = jest.mocked(sendUpdatedEmail);
const mockCronSchedule = jest.mocked(cron.schedule);

const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('SchedulerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset private static property isPreviousTaskEnded
    (SchedulerService as any).isPreviousTaskEnded = true;
  });

  afterEach(() => {
    mockConsoleLog.mockReset();
    mockConsoleError.mockReset();
  });

  describe('init', () => {
    it('should schedule a cron job every 15 minutes', () => {
      SchedulerService.init();
      expect(mockCronSchedule).toHaveBeenCalledWith('*/15 * * * *', expect.any(Function));
    });

    it('should trigger watcher when cron schedules job', () => {
      SchedulerService.init();
      const cronCallback = mockCronSchedule.mock.calls[0]?.[1] as Function;
      
      const watcherSpy = jest.spyOn(SchedulerService as any, 'watcher').mockImplementation(async () => {});
      
      cronCallback();
      
      expect(watcherSpy).toHaveBeenCalled();
      watcherSpy.mockRestore();
    });
  });

  describe('watcher', () => {
    it('should not run if isPreviousTaskEnded is false', async () => {
      (SchedulerService as any).isPreviousTaskEnded = false;
      
      await (SchedulerService as any).watcher();
      
      expect(mockGetAllSubscribedRepos).not.toHaveBeenCalled();
    });

    it('should fetch repos, check updates, and send emails', async () => {
      const mockWatchList = [{ repo: 'owner/repo', last_seen_tag: 'v1.0.0' }];
      const mockUpdatedTags = [{ repo: 'owner/repo', last_seen_tag: 'v1.0.0', newTag: 'v1.1.0' }];
      const mockEmails = [{ email: 'user@example.com' }];

      mockGetAllSubscribedRepos.mockResolvedValue(mockWatchList as any);
      mockGetUpdatedTag.mockResolvedValue(mockUpdatedTags as any);
      mockGetEmailsListByRepoAndTagAndUpdateTag.mockResolvedValue(mockEmails as any);
      mockSendUpdatedEmail.mockResolvedValue({} as any);

      await (SchedulerService as any).watcher();

      expect(mockGetAllSubscribedRepos).toHaveBeenCalled();
      expect(mockGetUpdatedTag).toHaveBeenCalledWith(mockWatchList);
      expect(mockGetEmailsListByRepoAndTagAndUpdateTag).toHaveBeenCalledWith('owner/repo', 'v1.0.0', 'v1.1.0');
      
      // Since map doesn't await inner promises in watcher, we need to wait for them to finish in the test
      // To ensure promises from map inside watcher are resolved
      await new Promise(process.nextTick);

      expect(mockSendUpdatedEmail).toHaveBeenCalledWith('user@example.com', 'owner/repo', 'v1.1.0');
      expect(mockConsoleLog).toHaveBeenCalledWith(mockUpdatedTags);
      expect((SchedulerService as any).isPreviousTaskEnded).toBe(true);
    });

    it('should handle empty updated list', async () => {
      mockGetAllSubscribedRepos.mockResolvedValue([]);
      mockGetUpdatedTag.mockResolvedValue([]);

      await (SchedulerService as any).watcher();

      expect(mockGetEmailsListByRepoAndTagAndUpdateTag).not.toHaveBeenCalled();
      expect(mockSendUpdatedEmail).not.toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith([]);
    });

    it('should handle multiple repos and emails', async () => {
      const mockWatchList = [
        { repo: 'owner/repo1', last_seen_tag: 'v1.0.0' },
        { repo: 'owner/repo2', last_seen_tag: 'v2.0.0' }
      ];
      const mockUpdatedTags = [
        { repo: 'owner/repo1', last_seen_tag: 'v1.0.0', newTag: 'v1.1.0' },
        { repo: 'owner/repo2', last_seen_tag: 'v2.0.0', newTag: 'v2.1.0' }
      ];
      
      mockGetAllSubscribedRepos.mockResolvedValue(mockWatchList as any);
      mockGetUpdatedTag.mockResolvedValue(mockUpdatedTags as any);
      
      mockGetEmailsListByRepoAndTagAndUpdateTag
        .mockResolvedValueOnce([{ email: 'user1@example.com' }, { email: 'user2@example.com' }] as any)
        .mockResolvedValueOnce([{ email: 'user3@example.com' }] as any);

      await (SchedulerService as any).watcher();

      await new Promise(process.nextTick);
      await new Promise(process.nextTick); // Extra ticks for nested maps

      expect(mockGetEmailsListByRepoAndTagAndUpdateTag).toHaveBeenCalledTimes(2);
      expect(mockSendUpdatedEmail).toHaveBeenCalledTimes(3);
      expect(mockSendUpdatedEmail).toHaveBeenCalledWith('user1@example.com', 'owner/repo1', 'v1.1.0');
      expect(mockSendUpdatedEmail).toHaveBeenCalledWith('user2@example.com', 'owner/repo1', 'v1.1.0');
      expect(mockSendUpdatedEmail).toHaveBeenCalledWith('user3@example.com', 'owner/repo2', 'v2.1.0');
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Database connection failed');
      mockGetAllSubscribedRepos.mockRejectedValue(error);

      await (SchedulerService as any).watcher();

      expect(mockConsoleError).toHaveBeenCalledWith('every 15 min:', error);
      expect((SchedulerService as any).isPreviousTaskEnded).toBe(true);
    });

    it('should set isPreviousTaskEnded to true even if an error occurs', async () => {
      mockGetAllSubscribedRepos.mockRejectedValue(new Error('Fail'));
      
      // Manually set to false to see if it becomes true
      (SchedulerService as any).isPreviousTaskEnded = false;
      
      // But watcher only proceeds if it's true. So I'll set it to true and see it stays true after error.
      (SchedulerService as any).isPreviousTaskEnded = true;

      await (SchedulerService as any).watcher();
      
      expect((SchedulerService as any).isPreviousTaskEnded).toBe(true);
    });
  });
});
