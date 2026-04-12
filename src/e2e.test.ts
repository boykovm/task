import request from 'supertest';
import { app } from './index';
import { jest, expect, describe, it, beforeEach } from '@jest/globals';
import { githubService } from './services/github.service';
import * as emailService from './services/email.service';
import { ConfirmationAction } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";

// Mock Prisma at the very beginning
jest.mock('../lib/prisma', () => {
  const { ConfirmationAction } = require("../generated/prisma/enums");
  
  class MockPrisma {
    private _subscriptions = new Map<string, any>();
    private _confirmations = new Map<string, any>();

    subscription = {
      create: jest.fn(async ({ data }: any) => {
        const id = `sub_${Math.random().toString(36).substr(2, 9)}`;
        const { confirmations, ...rest } = data;
        const sub = { id, confirmed: false, last_seen_tag: '', ...rest };
        this._subscriptions.set(id, sub);
        
        if (confirmations?.create) {
          const cData = Array.isArray(confirmations.create) ? confirmations.create : [confirmations.create];
          for (const c of cData) {
            const cId = `conf_${Math.random().toString(36).substr(2, 9)}`;
            this._confirmations.set(cId, { 
              id: cId, 
              subscriptionId: id, 
              action: ConfirmationAction.SUBSCRIBE,
              ...c 
            });
          }
        }
        return sub;
      }),
      findMany: jest.fn(async ({ where }: any = {}) => {
        let results = Array.from(this._subscriptions.values());
        if (where?.email) results = results.filter(s => s.email === where.email);
        if (where?.repo) results = results.filter(s => s.repo === where.repo);
        return results;
      }),
      findFirst: jest.fn(async ({ where }: any = {}) => {
        return Array.from(this._subscriptions.values()).find(s => {
          if (where.id && s.id !== where.id) return false;
          if (where.email && s.email !== where.email) return false;
          if (where.repo && s.repo !== where.repo) return false;
          return true;
        });
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const sub = Array.from(this._subscriptions.values()).find(s => {
          if (where.id && s.id === where.id) return true;
          if (where.email && s.email === where.email && where.repo && s.repo === where.repo) return true;
          return false;
        });
        if (sub) {
          Object.assign(sub, data);
          if (data.confirmations?.update) {
            const updateOp = data.confirmations.update;
            const conf = Array.from(this._confirmations.values()).find(c => c.id === updateOp.where.id);
            if (conf) Object.assign(conf, updateOp.data);
          }
        }
        return sub;
      }),
      deleteMany: jest.fn(async () => { this._subscriptions.clear(); }),
    };

    confirmation = {
      findFirst: jest.fn(async ({ where }: any) => {
        return Array.from(this._confirmations.values()).find(c => {
          if (where.token && c.token !== where.token) return false;
          if (where.action && c.action !== where.action) return false;
          if (where.subscription?.email) {
            const sub = this._subscriptions.get(c.subscriptionId);
            if (!sub || sub.email !== where.subscription.email) return false;
          }
          return true;
        });
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const conf = this._confirmations.get(where.id);
        if (conf) {
          const { subscription, ...rest } = data;
          Object.assign(conf, rest);
          if (subscription?.update?.data) {
            const sub = this._subscriptions.get(conf.subscriptionId);
            if (sub) Object.assign(sub, subscription.update.data);
          }
        }
        return conf;
      }),
      findMany: jest.fn(async ({ where }: any = {}) => {
         return Array.from(this._confirmations.values()).filter(c => {
          if (where?.subscription?.email) {
            const sub = this._subscriptions.get(c.subscriptionId);
            if (!sub || sub.email !== where.subscription.email) return false;
          }
          return true;
        });
      }),
      deleteMany: jest.fn(async () => { this._confirmations.clear(); }),
    };
  }

  return {
    prisma: new MockPrisma(),
  };
});

// Mock services that make external calls
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

describe('E2E Subscription Flow (with Validating Mocked DB)', () => {
  const testEmail = 'e2e-test@example.com';
  const testRepo = 'owner/repo';

  beforeEach(async () => {
    jest.clearAllMocks();
    // Clear the mocked DB before each test
    await prisma.confirmation.deleteMany();
    await prisma.subscription.deleteMany();
  });

  it('should complete the full subscription and unsubscription flow and validate DB state', async () => {
    // 1. Setup mocks for external services
    (githubService.isRepoExists as jest.MockedFunction<typeof githubService.isRepoExists>).mockResolvedValue(true);
    (githubService.getReleaseTagByRepo as jest.MockedFunction<typeof githubService.getReleaseTagByRepo>).mockResolvedValue('v1.0.0');

    // 2. POST /api/subscribe
    const createRes = await request(app)
      .post('/api/subscribe')
      .type('form')
      .send({ email: testEmail, repo: testRepo });

    expect(createRes.status).toBe(200);
    expect(createRes.text).toBe('Subscription successful. Confirmation email sent.');

    // VALIDATE DB: Check subscription was created with confirmed: false
    const subscriptions = await prisma.subscription.findMany({ where: { email: testEmail } });
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]?.repo).toBe(testRepo);
    expect(subscriptions[0]?.confirmed).toBe(false);

    // VALIDATE DB: Check confirmation record was created
    const confirmations = await prisma.confirmation.findMany({ 
      where: { subscription: { email: testEmail } } as any
    });
    expect(confirmations).toHaveLength(1);
    const token = confirmations[0]!.token;
    expect(token).toBeDefined();

    // 3. GET /api/subscriptions (before confirmation)
    const getSubsRes1 = await request(app)
      .get(`/api/subscriptions?email=${testEmail}`);
    
    expect(getSubsRes1.status).toBe(200);
    expect(getSubsRes1.body).toHaveLength(1);
    expect(getSubsRes1.body[0].confirmed).toBe(false);

    // 4. Confirm subscription
    // The token is sent in the email, which we mocked. 
    expect(emailService.sendConfirmationEmail).toHaveBeenCalledWith(testEmail, token);
    
    const confirmTokenEncoded = Buffer.from(token!).toString('base64url');
    const confirmRes = await request(app)
      .get(`/api/confirm/${confirmTokenEncoded}`);

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.text).toBe('Subscription confirmed successfully');

    // VALIDATE DB: Check subscription is now confirmed
    const updatedSub = await prisma.subscription.findFirst({ where: { email: testEmail, repo: testRepo } });
    expect(updatedSub?.confirmed).toBe(true);

    // VALIDATE DB: Check confirmation token was updated to UNSUBSCRIBE action
    const allConfirmations = await prisma.confirmation.findMany();
    const updatedConf = allConfirmations.find(c => c.subscriptionId === updatedSub?.id);
    expect(updatedConf?.action).toBe(ConfirmationAction.UNSUBSCRIBE);
    const unsubscribeToken = updatedConf?.token;

    // 5. GET /api/subscriptions (after confirmation)
    const getSubsRes2 = await request(app)
      .get(`/api/subscriptions?email=${testEmail}`);
    
    expect(getSubsRes2.status).toBe(200);
    expect(getSubsRes2.body[0].confirmed).toBe(true);

    // 6. Unsubscribe
    const unsubscribeTokenEncoded = Buffer.from(unsubscribeToken!).toString('base64url');
    const unsubscribeRes = await request(app)
      .get(`/api/unsubscribe/${unsubscribeTokenEncoded}`);

    expect(unsubscribeRes.status).toBe(200);
    expect(unsubscribeRes.text).toBe('Unsubscribed successfully');

    // VALIDATE DB: Check subscription is now NOT confirmed
    const unsubscribedSub = await prisma.subscription.findFirst({ where: { email: testEmail, repo: testRepo } });
    expect(unsubscribedSub?.confirmed).toBe(false);

    // VALIDATE DB: Check confirmation token was updated back to SUBSCRIBE action
    const finalConf = (await prisma.confirmation.findMany()).find(c => c.subscriptionId === unsubscribedSub?.id);
    expect(finalConf?.action).toBe(ConfirmationAction.SUBSCRIBE);

    // 7. GET /api/subscriptions (after unsubscription)
    const getSubsRes3 = await request(app)
      .get(`/api/subscriptions?email=${testEmail}`);
    
    expect(getSubsRes3.status).toBe(200);
    expect(getSubsRes3.body[0].confirmed).toBe(false);
  });
});
