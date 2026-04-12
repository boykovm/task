import { type Request, type Response } from 'express';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  },
}));

import { createSubscription, confirmSubscription, unsubscribe, getSubscriptions } from './subscription';
import { create, getSubscriptionsByEmail } from '../models/subscription';
import { githubService } from '../services/github.service';
import { sendEmail, sendConfirmationEmail, sendUpdateEmail, isValidEmail } from '../services/email.service';
import { verifyToken } from '../services/jwt.service';
import { confirmSubscription as confirmSubscriptionByEmailAndToken, unsubscribeFromSubscription } from '../models/confirmation';
import { ConfirmationAction } from "../../generated/prisma/enums";

jest.mock('../models/subscription', () => ({
  create: jest.fn(),
  getSubscriptionsByEmail: jest.fn(),
}));

jest.mock('../services/github.service', () => ({
  githubService: {
    isRepoExists: jest.fn(),
    getReleaseTagByRepo: jest.fn(() => Promise.resolve('v1.0.0')),
  },
}));

jest.mock('../services/email.service', () => ({
  sendEmail: jest.fn(),
  isValidEmail: jest.fn((email: string) => email && email.includes('@')),
  sendConfirmationEmail: jest.fn(() => Promise.resolve()),
  sendUpdateEmail: jest.fn(() => Promise.resolve()),
}));

jest.mock('../services/jwt.service', () => ({
  verifyToken: jest.fn(),
  generateToken: jest.fn(),
}));

jest.mock('../models/confirmation', () => ({
  confirmSubscription: jest.fn(),
  unsubscribeFromSubscription: jest.fn(),
}));

const mockCreate = jest.mocked(create);
const mockGetSubscriptionsByEmail = jest.mocked(getSubscriptionsByEmail);
const mockIsRepoExists = jest.mocked(githubService.isRepoExists);
const mockSendEmail = jest.mocked(sendEmail);
const mockSendConfirmationEmail = jest.mocked(sendConfirmationEmail);
const mockSendUpdateEmail = jest.mocked(sendUpdateEmail);
const mockIsValidEmail = jest.mocked(isValidEmail);
const mockVerifyToken = jest.mocked(verifyToken);
const mockConfirmSubscriptionByEmailAndToken = jest.mocked(confirmSubscriptionByEmailAndToken);
const mockUnsubscribeFromSubscription = jest.mocked(unsubscribeFromSubscription);

const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

type MockReq = Partial<Request> & {
  body?: unknown;
  params?: Record<string, string>;
  query?: unknown;
};

const buildResponse = () => {
  return {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  } as unknown as Response;
};

describe('subscription model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSubscription', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return 400 status when body is missing', async () => {
      const req = { } as MockReq as Request;
      const res = buildResponse();

      await createSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid input');
    })

    it('returns 400 when required fields are missing', async () => {
      const req = { body: { email: '', repo: '' } } as MockReq as Request;
      const res = buildResponse();

      await createSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        'Email is required, Repository is required, Email is invalid, Repository must be in the format "owner/repo", Repository must be in the format "owner/repo"'
      );
    });

    it('returns 400 when required email is missing', async () => {
      const req = { body: { repo: 'onwer/repo' } } as MockReq as Request;
      const res = buildResponse();

      await createSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        'Email is required, Email is invalid'
      );
    });

    it('returns 400 when required repo is missing', async () => {
      const req = { body: { email: 'example@example.com' } } as MockReq as Request;
      const res = buildResponse();

      await createSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        'Repository is required, Repository must be in the format \"owner/repo\", Repository must be in the format \"owner/repo\"'
      );
    });

    it('returns 400 when repo name was not provided', async () => {
      const req = { body: { email: 'example@example.com', repo: 'name/' } } as MockReq as Request;
      const res = buildResponse();

      await createSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        'Repository must be in the format \"owner/repo\"'
      );
    });

    it('returns 400 when owner repo was not provided', async () => {
      const req = { body: { email: 'example@example.com', repo: '/owner' } } as MockReq as Request;
      const res = buildResponse();

      await createSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        'Repository must be in the format \"owner/repo\"'
      );
    });

    it('should handle incorrect repo formats', async () => {
      const req = { body: { email: 'example@example.com', repo: ' / ' } } as MockReq as Request;
      const res = buildResponse();

      await createSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        'Repository must be in the format \"owner/repo\"'
      );
    })

    it('returns 404 when repository does not exist on GitHub', async () => {
      const req = { body: { email: 'example@example.com', repo: 'owner/repo' } } as MockReq as Request;
      const res = buildResponse();
      mockIsRepoExists.mockResolvedValue(false);

      await createSubscription(req, res);

      expect(mockIsRepoExists).toHaveBeenCalledWith('owner', 'repo');
      expect(mockCreate).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('Repository not found on GitHub');
    });

    it('creates subscription and sends confirmation email', async () => {
      const req = { body: { email: 'example@example.com', repo: 'owner/repo' } } as MockReq as Request;
      const res = buildResponse();

      mockIsRepoExists.mockResolvedValue(true);
      mockCreate.mockResolvedValue({
        subscription: {
          id: '123',
          email: 'example@example.com',
          repo: 'owner/repo',
          confirmed: false,
          last_seen_tag: 'v1.0.0',
        },
        token: 'mock-token'
      });

      await createSubscription(req, res);

      expect(mockCreate).toHaveBeenCalledWith({ email: 'example@example.com', repo: 'owner/repo', last_seen_tag: 'v1.0.0' });
      expect(mockSendConfirmationEmail).toHaveBeenCalledWith('example@example.com', 'mock-token');
      expect(res.send).toHaveBeenCalledWith('Subscription successful. Confirmation email sent.');
    });

    it('returns 409 when email is already subscribed to repository', async () => {
      const req = { body: { email: 'example@example.com', repo: 'owner/repo' } } as MockReq as Request;
      const res = buildResponse();

      mockIsRepoExists.mockResolvedValue(true);
      const uniqueError = Object.assign(new Error('Unique constraint failed'), {
        name: 'PrismaClientKnownRequestError',
        code: 'P2002',
      });
      mockCreate.mockRejectedValue(uniqueError);

      await createSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.send).toHaveBeenCalledWith('Email already subscribed to this repository');
    });

    it('should return 500 status when unexpected error occurs', async () => {
      const req = { body: { email: 'example@example.com', repo: 'owner/repo' } } as MockReq as Request;
      const res = buildResponse();

      mockIsRepoExists.mockResolvedValue(true);
      mockCreate.mockRejectedValue(new Error('Unexpected error'));

      await createSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Internal Server Error');
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('should continue if sendConfirmationEmail fails', async () => {
      const req = { body: { email: 'example@example.com', repo: 'owner/repo' } } as MockReq as Request;
      const res = buildResponse();

      mockIsRepoExists.mockResolvedValue(true);
      mockCreate.mockResolvedValue({
        subscription: { id: '123' } as any,
        token: 'mock-token'
      });
      mockSendConfirmationEmail.mockRejectedValue(new Error('Email failed'));

      await createSubscription(req, res);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(res.send).toHaveBeenCalledWith('Subscription successful. Confirmation email sent.');
    });
  });

  describe('confirmSubscription', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns 400 when token is missing', async () => {
      const req = { params: {} } as MockReq as Request;
      const res = buildResponse();

      await confirmSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid token');
    });

    it('returns 400 when token is invalid (verifyToken fails)', async () => {
      const req = { params: { token: Buffer.from('invalid-token').toString('base64url') } } as MockReq as Request;
      const res = buildResponse();
      mockVerifyToken.mockImplementation(() => { throw new Error('invalid'); });

      await confirmSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid token');
    });

    it('returns 400 when token action is not SUBSCRIBE', async () => {
      const req = { params: { token: Buffer.from('unsub-token').toString('base64url') } } as MockReq as Request;
      const res = buildResponse();
      mockVerifyToken.mockReturnValue({ action: ConfirmationAction.UNSUBSCRIBE, email: 'a@b.c', repo: 'o/r' });

      await confirmSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid token');
    });

    it('returns 404 when token is not found in DB', async () => {
      const req = { params: { token: Buffer.from('valid-token').toString('base64url') } } as MockReq as Request;
      const res = buildResponse();
      mockVerifyToken.mockReturnValue({ action: ConfirmationAction.SUBSCRIBE, email: 'a@b.c', repo: 'o/r' });
      mockConfirmSubscriptionByEmailAndToken.mockResolvedValue(null);

      await confirmSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('Token not found');
    });

    it('confirms subscription and sends update email', async () => {
      const rawToken = 'valid-token';
      const req = { params: { token: Buffer.from(rawToken).toString('base64url') } } as MockReq as Request;
      const res = buildResponse();
      mockVerifyToken.mockReturnValue({ action: ConfirmationAction.SUBSCRIBE, email: 'a@b.c', repo: 'o/r' });
      mockConfirmSubscriptionByEmailAndToken.mockResolvedValue('new-token');

      await confirmSubscription(req, res);

      expect(mockConfirmSubscriptionByEmailAndToken).toHaveBeenCalledWith('a@b.c', 'o/r', rawToken);
      expect(mockSendUpdateEmail).toHaveBeenCalledWith('a@b.c', 'new-token', 'o/r', ConfirmationAction.SUBSCRIBE);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith('Subscription confirmed successfully');
    });

    it('returns 500 on unexpected error', async () => {
      const req = { params: { token: Buffer.from('token').toString('base64url') } } as MockReq as Request;
      const res = buildResponse();
      mockVerifyToken.mockImplementation(() => { throw new Error('Unexpected'); });
      // In confirmSubscription, the inner catch for verifyToken returns 400.
      // To trigger 500, we need an error outside that block or in confirmSubscriptionByEmailAndToken
      mockVerifyToken.mockReturnValue({ action: ConfirmationAction.SUBSCRIBE, email: 'a@b.c', repo: 'o/r' });
      mockConfirmSubscriptionByEmailAndToken.mockRejectedValue(new Error('DB error'));

      await confirmSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Internal Server Error');
    });

    it('returns 400 when verifyToken returns null', async () => {
      const req = { params: { token: Buffer.from('token').toString('base64url') } } as MockReq as Request;
      const res = buildResponse();
      mockVerifyToken.mockReturnValue(null as any);

      await confirmSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid token');
    });

    it('should continue if sendUpdateEmail fails in confirmSubscription', async () => {
      const req = { params: { token: Buffer.from('token').toString('base64url') } } as MockReq as Request;
      const res = buildResponse();
      mockVerifyToken.mockReturnValue({ action: ConfirmationAction.SUBSCRIBE, email: 'a@b.c', repo: 'o/r' });
      mockConfirmSubscriptionByEmailAndToken.mockResolvedValue('new-token');
      mockSendUpdateEmail.mockRejectedValue(new Error('Email fail'));

      await confirmSubscription(req, res);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith('Subscription confirmed successfully');
    });
  });

  describe('unsubscribe', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns 400 when token is missing', async () => {
      const req = { params: {} } as MockReq as Request;
      const res = buildResponse();

      await unsubscribe(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid token');
    });

    it('returns 400 when token action is not UNSUBSCRIBE', async () => {
      const req = { params: { token: Buffer.from('sub-token').toString('base64url') } } as MockReq as Request;
      const res = buildResponse();
      mockVerifyToken.mockReturnValue({ action: ConfirmationAction.SUBSCRIBE, email: 'a@b.c', repo: 'o/r' });

      await unsubscribe(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid token');
    });

    it('unsubscribes and sends update email', async () => {
      const rawToken = 'valid-token';
      const req = { params: { token: Buffer.from(rawToken).toString('base64url') } } as MockReq as Request;
      const res = buildResponse();
      mockVerifyToken.mockReturnValue({ action: ConfirmationAction.UNSUBSCRIBE, email: 'a@b.c', repo: 'o/r' });
      mockUnsubscribeFromSubscription.mockResolvedValue('new-token');

      await unsubscribe(req, res);

      expect(mockUnsubscribeFromSubscription).toHaveBeenCalledWith('a@b.c', 'o/r', rawToken);
      expect(mockSendUpdateEmail).toHaveBeenCalledWith('a@b.c', 'new-token', 'o/r', ConfirmationAction.UNSUBSCRIBE);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith('Unsubscribed successfully');
    });

    it('returns 404 if token not found in DB', async () => {
      const req = { params: { token: Buffer.from('valid-token').toString('base64url') } } as MockReq as Request;
      const res = buildResponse();
      mockVerifyToken.mockReturnValue({ action: ConfirmationAction.UNSUBSCRIBE, email: 'a@b.c', repo: 'o/r' });
      mockUnsubscribeFromSubscription.mockResolvedValue(null);

      await unsubscribe(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('Token not found');
    });

    it('returns 400 when token is invalid in unsubscribe (verifyToken fails)', async () => {
      const req = { params: { token: Buffer.from('invalid').toString('base64url') } } as MockReq as Request;
      const res = buildResponse();
      mockVerifyToken.mockImplementation(() => { throw new Error('invalid'); });

      await unsubscribe(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid token');
    });

    it('returns 500 on unexpected error in unsubscribe', async () => {
      const req = { params: { token: Buffer.from('token').toString('base64url') } } as MockReq as Request;
      const res = buildResponse();
      mockVerifyToken.mockReturnValue({ action: ConfirmationAction.UNSUBSCRIBE, email: 'a@b.c', repo: 'o/r' });
      mockUnsubscribeFromSubscription.mockRejectedValue(new Error('Unexpected'));

      await unsubscribe(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Internal Server Error');
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('should continue if sendUpdateEmail fails in unsubscribe', async () => {
      const req = { params: { token: Buffer.from('token').toString('base64url') } } as MockReq as Request;
      const res = buildResponse();
      mockVerifyToken.mockReturnValue({ action: ConfirmationAction.UNSUBSCRIBE, email: 'a@b.c', repo: 'o/r' });
      mockUnsubscribeFromSubscription.mockResolvedValue('new-token');
      mockSendUpdateEmail.mockRejectedValue(new Error('Email fail'));

      await unsubscribe(req, res);

      expect(mockConsoleError).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith('Unsubscribed successfully');
    });
  });

  describe('getSubscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 on invalid email', async () => {
    const req = { query: { email: 'invalid' } } as MockReq as Request;
    const res = buildResponse();
    mockIsValidEmail.mockReturnValue(false);

    await getSubscriptions(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid email');
  });

  it('returns 200 and subscriptions on success', async () => {
    const email = 'test@example.com';
    const req = { query: { email } } as MockReq as Request;
    const res = buildResponse();
    const mockSubs = [{ repo: 'o/r', confirmed: true }];
    mockIsValidEmail.mockReturnValue(true);
    mockGetSubscriptionsByEmail.mockResolvedValue(mockSubs as any);

    await getSubscriptions(req, res);

    expect(mockGetSubscriptionsByEmail).toHaveBeenCalledWith(email);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(mockSubs);
  });

  it('returns 500 on unexpected error', async () => {
    const req = { query: { email: 'a@b.c' } } as MockReq as Request;
    const res = buildResponse();
    mockIsValidEmail.mockReturnValue(true);
    mockGetSubscriptionsByEmail.mockRejectedValue(new Error('Oops'));

    await getSubscriptions(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Internal Server Error');
    expect(mockConsoleError).toHaveBeenCalled();
  });
});
});
