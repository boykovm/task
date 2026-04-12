import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { ConfirmationAction } from "../../generated/prisma/enums";

jest.mock('../../lib/prisma', () => ({
    prisma: {
        confirmation: {
            findFirst: jest.fn(),
            update: jest.fn(),
        },
        subscription: {
            update: jest.fn(),
        },
    },
}));

jest.mock('../services/jwt.service', () => ({
    generateToken: jest.fn(),
}));

import { prisma } from "../../lib/prisma";
import { generateToken } from "../services/jwt.service";
import { findConfirmation, confirmSubscription, unsubscribeFromSubscription } from "./confirmation";

const mockedPrisma = jest.mocked(prisma);
const mockedGenerateToken = jest.mocked(generateToken);

describe('confirmation model', () => {
    const email = 'test@example.com';
    const repo = 'owner/repo';
    const token = 'test-token';
    const newToken = 'new-test-token';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('findConfirmation', () => {
        it('should call prisma.confirmation.findFirst with correct parameters', async () => {
            const mockConfirmation = { id: '1', token, action: ConfirmationAction.SUBSCRIBE, subscriptionId: 'sub1' };
            (mockedPrisma.confirmation.findFirst as jest.MockedFunction<typeof prisma.confirmation.findFirst>).mockResolvedValue(mockConfirmation);

            const result = await findConfirmation(email, token, ConfirmationAction.SUBSCRIBE);

            expect(mockedPrisma.confirmation.findFirst).toHaveBeenCalledWith({
                where: {
                    token,
                    action: ConfirmationAction.SUBSCRIBE,
                    subscription: {
                        email,
                    },
                }
            });
            expect(result).toEqual(mockConfirmation);
        });

        it('should return null if confirmation is not found', async () => {
            (mockedPrisma.confirmation.findFirst as jest.MockedFunction<typeof prisma.confirmation.findFirst>).mockResolvedValue(null);

            const result = await findConfirmation(email, token, ConfirmationAction.SUBSCRIBE);

            expect(result).toBeNull();
        });
    });

    describe('confirmSubscription', () => {
        it('should return null if confirmation not found', async () => {
            (mockedPrisma.confirmation.findFirst as jest.MockedFunction<typeof prisma.confirmation.findFirst>).mockResolvedValue(null);

            const result = await confirmSubscription(email, repo, token);

            expect(result).toBeNull();
            expect(mockedPrisma.confirmation.update).not.toHaveBeenCalled();
        });

        it('should update confirmation and return new token on success', async () => {
            const mockConfirmation = { id: 'conf-id', token, action: ConfirmationAction.SUBSCRIBE, subscriptionId: 'sub-id' };
            (mockedPrisma.confirmation.findFirst as jest.MockedFunction<typeof prisma.confirmation.findFirst>).mockResolvedValue(mockConfirmation);
            mockedGenerateToken.mockReturnValue(newToken);

            const result = await confirmSubscription(email, repo, token);

            expect(mockedGenerateToken).toHaveBeenCalledWith(email, repo, ConfirmationAction.UNSUBSCRIBE);
            expect(mockedPrisma.confirmation.update).toHaveBeenCalledWith({
                where: { id: mockConfirmation.id },
                data: {
                    action: ConfirmationAction.UNSUBSCRIBE,
                    token: newToken,
                    subscription: {
                        update: {
                            data: { confirmed: true }
                        }
                    }
                }
            });
            expect(result).toBe(newToken);
        });
    });

    describe('unsubscribeFromSubscription', () => {
        it('should return null if confirmation not found', async () => {
            (mockedPrisma.confirmation.findFirst as jest.MockedFunction<typeof prisma.confirmation.findFirst>).mockResolvedValue(null);

            const result = await unsubscribeFromSubscription(email, repo, token);

            expect(result).toBeNull();
            expect(mockedPrisma.subscription.update).not.toHaveBeenCalled();
        });

        it('should update subscription and return new token on success', async () => {
            const mockConfirmation = { id: 'conf-id', token, action: ConfirmationAction.UNSUBSCRIBE, subscriptionId: 'sub-id' };
            (mockedPrisma.confirmation.findFirst as jest.MockedFunction<typeof prisma.confirmation.findFirst>).mockResolvedValue(mockConfirmation);
            mockedGenerateToken.mockReturnValue(newToken);

            const result = await unsubscribeFromSubscription(email, repo, token);

            expect(mockedGenerateToken).toHaveBeenCalledWith(email, repo, ConfirmationAction.SUBSCRIBE);
            expect(mockedPrisma.subscription.update).toHaveBeenCalledWith({
                where: { id: mockConfirmation.subscriptionId },
                data: {
                    confirmed: false,
                    confirmations: {
                        update: {
                            where: { id: mockConfirmation.id },
                            data: {
                                action: ConfirmationAction.SUBSCRIBE,
                                token: newToken
                            }
                        }
                    }
                }
            });
            expect(result).toBe(newToken);
        });
    });
});
