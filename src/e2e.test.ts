import request from 'supertest';
import { app } from './index';
import { jest, expect, describe, it, beforeEach } from '@jest/globals';
import { githubService } from './services/github.service';
import * as subscriptionModel from './models/subscription';
import * as confirmationModel from './models/confirmation';
import * as emailService from './services/email.service';
import { ConfirmationAction } from "../generated/prisma/enums";
import type {SubscriptionEntity} from "./models/subscription.entity";

// Mock Prisma at the very beginning to avoid import.meta issue
jest.mock('../lib/prisma', () => ({
  prisma: {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    subscription: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    confirmation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    }
  },
}));

// Mock services and models
jest.mock('./services/github.service', () => ({
  githubService: {
    isRepoExists: jest.fn(),
    getReleaseTagByRepo: jest.fn(),
  },
}));

jest.mock('./services/email.service', () => ({
  isValidEmail: jest.fn((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
  sendConfirmationEmail: jest.fn(() => Promise.resolve()),
  sendUpdateEmail: jest.fn(() => Promise.resolve()),
}));

jest.mock('./models/subscription', () => ({
  create: jest.fn(),
  getSubscriptionsByEmail: jest.fn(),
}));

jest.mock('./models/confirmation', () => ({
  confirmSubscription: jest.fn(),
  unsubscribeFromSubscription: jest.fn(),
}));

// We need real JWT service for tokens to work unless we mock that too
// But we can mock it to return predictable things
jest.mock('./services/jwt.service', () => ({
  generateToken: jest.fn((email, repo, action) => `mock-token-${email}-${repo}-${action}`),
  verifyToken: jest.fn((token: string) => {
    if (token.includes('SUBSCRIBE') && !token.includes('UNSUBSCRIBE')) {
      return { email: 'e2e-test@example.com', repo: 'owner/repo', action: ConfirmationAction.SUBSCRIBE };
    }
    if (token.includes('UNSUBSCRIBE')) {
      return { email: 'e2e-test@example.com', repo: 'owner/repo', action: ConfirmationAction.UNSUBSCRIBE };
    }
    throw new Error('Invalid token');
  }),
}));

describe('E2E Subscription Flow (Mocked DB)', () => {
  const testEmail = 'e2e-test@example.com';
  const testRepo = 'owner/repo';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should complete the full subscription and unsubscription flow', async () => {
    // 1. Setup mocks for Create Subscription
    (githubService.isRepoExists as jest.MockedFunction<typeof githubService.isRepoExists>).mockResolvedValue(true);
    (githubService.getReleaseTagByRepo as jest.MockedFunction<typeof githubService.getReleaseTagByRepo>).mockResolvedValue('v1.0.0');
    (subscriptionModel.create as jest.MockedFunction<typeof subscriptionModel.create>).mockResolvedValue({
      subscription: { email: testEmail, repo: testRepo, confirmed: false } as SubscriptionEntity,
      token: `mock-token-${testEmail}-${testRepo}-${ConfirmationAction.SUBSCRIBE}`
    });

    // 2. POST /api/subscribe
    const createRes = await request(app)
      .post('/api/subscribe')
      .type('form')
      .send({ email: testEmail, repo: testRepo });

    expect(createRes.status).toBe(200);
    expect(createRes.text).toBe('Subscription successful. Confirmation email sent.');
    expect(emailService.sendConfirmationEmail).toHaveBeenCalledWith(
      testEmail, 
      `mock-token-${testEmail}-${testRepo}-${ConfirmationAction.SUBSCRIBE}`
    );

    // 3. GET /api/subscriptions (before confirmation)
    (subscriptionModel.getSubscriptionsByEmail as jest.MockedFunction<typeof subscriptionModel.getSubscriptionsByEmail>).mockResolvedValue([
      { email: testEmail, repo: testRepo, confirmed: false } as SubscriptionEntity
    ]);
    const getSubsRes1 = await request(app)
      .get(`/api/subscriptions?email=${testEmail}`);
    
    expect(getSubsRes1.status).toBe(200);
    expect(getSubsRes1.body).toHaveLength(1);
    expect(getSubsRes1.body[0].confirmed).toBe(false);

    // 4. Confirm subscription
    const confirmTokenRaw = `mock-token-${testEmail}-${testRepo}-${ConfirmationAction.SUBSCRIBE}`;
    const confirmTokenEncoded = Buffer.from(confirmTokenRaw).toString('base64url');
    
    (confirmationModel.confirmSubscription as jest.MockedFunction<typeof confirmationModel.confirmSubscription>).mockResolvedValue(
      `mock-token-${testEmail}-${testRepo}-${ConfirmationAction.UNSUBSCRIBE}`
    );

    const confirmRes = await request(app)
      .get(`/api/confirm/${confirmTokenEncoded}`);

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.text).toBe('Subscription confirmed successfully');
    expect(emailService.sendUpdateEmail).toHaveBeenCalledWith(
      testEmail,
      `mock-token-${testEmail}-${testRepo}-${ConfirmationAction.UNSUBSCRIBE}`,
      testRepo,
      ConfirmationAction.SUBSCRIBE
    );

    // 5. GET /api/subscriptions (after confirmation)
    (subscriptionModel.getSubscriptionsByEmail as jest.MockedFunction<typeof subscriptionModel.getSubscriptionsByEmail>).mockResolvedValue([
      { email: testEmail, repo: testRepo, confirmed: true } as SubscriptionEntity
    ]);
    const getSubsRes2 = await request(app)
      .get(`/api/subscriptions?email=${testEmail}`);
    
    expect(getSubsRes2.status).toBe(200);
    expect(getSubsRes2.body[0].confirmed).toBe(true);

    // 6. Unsubscribe
    const unsubscribeTokenRaw = `mock-token-${testEmail}-${testRepo}-${ConfirmationAction.UNSUBSCRIBE}`;
    const unsubscribeTokenEncoded = Buffer.from(unsubscribeTokenRaw).toString('base64url');

    (confirmationModel.unsubscribeFromSubscription as jest.MockedFunction<typeof confirmationModel.unsubscribeFromSubscription>).mockResolvedValue(
      `mock-token-${testEmail}-${testRepo}-${ConfirmationAction.SUBSCRIBE}`
    );

    const unsubscribeRes = await request(app)
      .get(`/api/unsubscribe/${unsubscribeTokenEncoded}`);

    expect(unsubscribeRes.status).toBe(200);
    expect(unsubscribeRes.text).toBe('Unsubscribed successfully');

    // 7. GET /api/subscriptions (after unsubscription)
    (subscriptionModel.getSubscriptionsByEmail as jest.MockedFunction<typeof subscriptionModel.getSubscriptionsByEmail>).mockResolvedValue([
      { email: testEmail, repo: testRepo, confirmed: false } as SubscriptionEntity
    ]);
    const getSubsRes3 = await request(app)
      .get(`/api/subscriptions?email=${testEmail}`);
    
    expect(getSubsRes3.status).toBe(200);
    expect(getSubsRes3.body[0].confirmed).toBe(false);
  });
});
