import { describe, expect, it, jest, beforeEach } from '@jest/globals';

jest.mock('../controllers/subscription', () => ({
  confirmSubscription: jest.fn(),
  createSubscription: jest.fn(),
  getSubscriptions: jest.fn(),
  unsubscribe: jest.fn(),
}));

import { confirmSubscription, createSubscription, getSubscriptions, unsubscribe } from '../controllers/subscription';
import subscriptionsRouter from './subscription';

describe('Subscriptions Router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getRoute = (path: string, method: string) => {
    return (subscriptionsRouter as any).stack.find(
      (layer: any) => layer.route.path === path && layer.route.methods[method]
    );
  };

  it('should register GET /confirm/:token', () => {
    const route = getRoute('/confirm/:token', 'get');
    expect(route).toBeDefined();
    expect(route.route.stack[0].handle).toBe(confirmSubscription);
  });

  it('should register POST /subscribe', () => {
    const route = getRoute('/subscribe', 'post');
    expect(route).toBeDefined();
    expect(route.route.stack[0].handle).toBe(createSubscription);
  });

  it('should register GET /subscriptions', () => {
    const route = getRoute('/subscriptions', 'get');
    expect(route).toBeDefined();
    expect(route.route.stack[0].handle).toBe(getSubscriptions);
  });

  it('should register GET /unsubscribe/:token', () => {
    const route = getRoute('/unsubscribe/:token', 'get');
    expect(route).toBeDefined();
    expect(route.route.stack[0].handle).toBe(unsubscribe);
  });
});
