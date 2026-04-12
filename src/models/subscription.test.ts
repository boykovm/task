import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { ConfirmationAction } from "../../generated/prisma/enums";

jest.mock('../../lib/prisma', () => ({
    prisma: {
        subscription: {
            create: jest.fn(),
            findMany: jest.fn(),
            updateManyAndReturn: jest.fn(),
        },
    },
}));

jest.mock('../services/jwt.service', () => ({
    generateToken: jest.fn(),
}));

import { prisma } from "../../lib/prisma";
import { generateToken } from "../services/jwt.service";
import { create, getSubscriptionsByEmail, getAllSubscribedRepos, getEmailsListByRepoAndTagAndUpdateTag } from "./subscription";
import type {SubscriptionEntity} from "./subscription.entity";

const mockedPrisma = jest.mocked(prisma);
const mockedGenerateToken = jest.mocked(generateToken);

describe('subscription model', () => {
    const email = 'test@example.com';
    const repo = 'owner/repo';
    const last_seen_tag = 'v1.0.0';
    const token = 'test-token';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should call prisma.subscription.create with correct data', async () => {
            const data = { email, repo, last_seen_tag };
            const mockSubscription = { id: '1', ...data, confirmed: false };
            
            mockedGenerateToken.mockReturnValue(token);
            (mockedPrisma.subscription.create as jest.MockedFunction<typeof prisma.subscription.create>).mockResolvedValue(mockSubscription);

            const result = await create(data);

            expect(mockedGenerateToken).toHaveBeenCalledWith(data.email, data.repo, ConfirmationAction.SUBSCRIBE);
            expect(mockedPrisma.subscription.create).toHaveBeenCalledWith({
                data: {
                    ...data,
                    confirmations: {
                        create: {
                            token,
                        }
                    }
                }
            });
            expect(result).toEqual({ subscription: mockSubscription, token });
        });
    });

    describe('getSubscriptionsByEmail', () => {
        it('should call prisma.subscription.findMany with correct parameters', async () => {
            const mockSubscriptions = [{ repo, confirmed: true } as SubscriptionEntity];
            (mockedPrisma.subscription.findMany as jest.MockedFunction<typeof prisma.subscription.findMany>).mockResolvedValue(mockSubscriptions);

            const result = await getSubscriptionsByEmail(email);

            expect(mockedPrisma.subscription.findMany).toHaveBeenCalledWith({
                where: { email },
                omit: { id: true }
            });
            expect(result).toEqual(mockSubscriptions);
        });
    });

    describe('getAllSubscribedRepos', () => {
        it('should call prisma.subscription.findMany with confirmed: true and correct select', async () => {
            const mockRepos = [{ repo, last_seen_tag } as SubscriptionEntity];
            (mockedPrisma.subscription.findMany as jest.MockedFunction<typeof prisma.subscription.findMany>).mockResolvedValue(mockRepos);

            const result = await getAllSubscribedRepos();

            expect(mockedPrisma.subscription.findMany).toHaveBeenCalledWith({
                where: { confirmed: true },
                select: {
                    repo: true,
                    last_seen_tag: true,
                },
                distinct: ["repo"]
            });
            expect(result).toEqual(mockRepos);
        });
    });

    describe('getEmailsListByRepoAndTagAndUpdateTag', () => {
        it('should call prisma.subscription.updateManyAndReturn with correct parameters', async () => {
            const newTag = 'v1.1.0';
            const mockResult = [{ email } as SubscriptionEntity];
            
            (mockedPrisma.subscription.updateManyAndReturn as jest.MockedFunction<typeof prisma.subscription.updateManyAndReturn>).mockResolvedValue(mockResult);

            const result = await getEmailsListByRepoAndTagAndUpdateTag(repo, last_seen_tag, newTag);

            expect(mockedPrisma.subscription.updateManyAndReturn).toHaveBeenCalledWith({
                select: {
                    email: true,
                },
                where: {
                    repo,
                    confirmed: true
                },
                data: {
                    last_seen_tag: newTag
                }
            });
            expect(result).toEqual(mockResult);
        });
    });
});
