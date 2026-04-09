import { type Request, type Response } from 'express';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { createSubscription } from './subscription';
import { create } from '../models/subscription';
import { isRepoExists } from '../services/github.service';
import { sendEmail } from '../services/email.service';

jest.mock('../models/subscription', () => ({
  create: jest.fn(),
  getSubscriptionsByEmail: jest.fn(),
}));

jest.mock('../services/github.service', () => ({
  isRepoExists: jest.fn(),
}));

jest.mock('../services/email.service', () => ({
  sendEmail: jest.fn(),
}));

const mockCreate = jest.mocked(create);
const mockIsRepoExists = jest.mocked(isRepoExists);
const mockSendEmail = jest.mocked(sendEmail);

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
      'Email is required, Repository is required, Repository must be in the format "owner/repo", Repository must be in the format \"owner/repo\"'
    );
  });

  it('returns 400 when required email is missing', async () => {
    const req = { body: { repo: 'onwer/repo' } } as MockReq as Request;
    const res = buildResponse();

    await createSubscription(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      'Email is required'
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
      id: '123',
      email: 'example@example.com',
      repo: 'owner/repo',
      confirmed: false,
      last_seen_tag: '',
    });
    mockSendEmail.mockResolvedValue(undefined);

    await createSubscription(req, res);

    expect(mockCreate).toHaveBeenCalledWith({ email: 'example@example.com', repo: 'owner/repo' });
    expect(mockSendEmail).toHaveBeenCalledWith('example@example.com');
    expect(res.send).toHaveBeenCalledWith('subscribe!');
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
  })
});

