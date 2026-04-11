import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { ConfirmationAction } from "../../generated/prisma/enums";

jest.mock('jsonwebtoken');

import { generateToken, verifyToken } from './jwt.service';

const mockedJwt = jest.mocked(jwt);

describe('jwt.service', () => {
    const email = 'test@example.com';
    const token = 'my-test-token';
    const action = ConfirmationAction.SUBSCRIBE;
    const secret = process.env.JWT_SECRET || 'your-very-secure-secret';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateToken', () => {
        it('should call jwt.sign with correct parameters', () => {
            const expectedPayload = { email, token, action };
            const expectedOptions = { algorithm: 'HS256', expiresIn: '24H' };
            const mockSignedToken = 'mocked.jwt.token';

            mockedJwt.sign.mockReturnValue(mockSignedToken as any);

            const result = generateToken(email, token, action);

            expect(mockedJwt.sign).toHaveBeenCalledWith(expectedPayload, secret, expectedOptions);
            expect(result).toBe(mockSignedToken);
        });
    });

    describe('verifyToken', () => {
        it('should call jwt.verify with correct parameters', () => {
            const testToken = 'some.token.here';
            const mockPayload = { email, token, action, iat: 12345678, exp: 87654321 };

            mockedJwt.verify.mockReturnValue(mockPayload as any);

            const result = verifyToken(testToken);

            expect(mockedJwt.verify).toHaveBeenCalledWith(testToken, secret);
            expect(result).toEqual(mockPayload);
        });

        it('should throw error if jwt.verify fails', () => {
            const testToken = 'invalid.token';
            mockedJwt.verify.mockImplementation(() => {
                throw new Error('invalid token');
            });

            expect(() => verifyToken(testToken)).toThrow('invalid token');
        });
    });
});
