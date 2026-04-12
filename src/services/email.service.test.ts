import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfirmationAction } from "../../generated/prisma/enums";

const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: mockSendMail,
  }),
}));

import {
	sendEmail,
	sendConfirmationEmail,
	sendUpdateEmail,
	sendUpdatedEmail,
	isValidEmail
} from './email.service';

describe('email.service', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('isValidEmail', () => {
		it.each([
			'test@example.com',
			'user.name+tag@gmail.co.uk',
			'a@b.c'
		])('should return true for valid emails', (email) => {
			expect(isValidEmail(email)).toBe(true);
		})

		it.each([
			'plainaddress',
			'#@%^%#$@#$@#.com',
			'@example.com',
			'Joe Smith <email@example.com>',
			'email.example.com',
			'email@example@example.com',
			'test@example'
		])('should return false for invalid emails', (email) => {
			expect(isValidEmail(email)).toBe(false);
		})
	});

	describe('sendEmail', () => {
		it('should call sendMail with correct parameters', async () => {
			const email = 'user@example.com';
			await sendEmail(email);

			expect(mockSendMail).toHaveBeenCalledWith({
				from: 'test@example.com',
				to: email,
				subject: 'Local Docker Email',
				text: 'It works!'
			});
		});
	});

	describe('sendConfirmationEmail', () => {
		it('should call sendMail with correct parameters and encoded token', async () => {
			const email = 'user@example.com';
			const token = 'my-secret-token';
			const encodedToken = Buffer.from(token).toString('base64url');
			const confirmationLink = `http://localhost:4443/api/confirm/${encodedToken}`;

			await sendConfirmationEmail(email, token);

			expect(mockSendMail).toHaveBeenCalledWith({
				from: 'test@example.com',
				to: email,
				subject: 'Confirm your subscription',
				text: `Please click on the link below to confirm your subscription: ${confirmationLink}`
			});
		});
	});

	describe('sendUpdateEmail', () => {
		it('should call sendMail for SUBSCRIBE action', async () => {
			const email = 'user@example.com';
			const token = 'my-token';
			const repo = 'owner/repo';
			const action = ConfirmationAction.SUBSCRIBE;
			const encodedToken = Buffer.from(token).toString('base64url');
			const newLink = `http://localhost:4443/api/unsubscribe/${encodedToken}`;

			await sendUpdateEmail(email, token, repo, action);

			expect(mockSendMail).toHaveBeenCalledWith({
				from: 'test@example.com',
				to: email,
				subject: 'Your subscription was updated',
				text: `Your subscription for ${repo} was updated to unsubscribed status. If you want to unsubscribe then click on the link below ${newLink}`
			});
		});

		it('should call sendMail for UNSUBSCRIBE action', async () => {
			const email = 'user@example.com';
			const token = 'my-token';
			const repo = 'owner/repo';
			const action = ConfirmationAction.UNSUBSCRIBE;
			const encodedToken = Buffer.from(token).toString('base64url');
			const newLink = `http://localhost:4443/api/confirm/${encodedToken}`;

			await sendUpdateEmail(email, token, repo, action);

			expect(mockSendMail).toHaveBeenCalledWith({
				from: 'test@example.com',
				to: email,
				subject: 'Your subscription was updated',
				text: `Your subscription for ${repo} was updated to subscribed status. If you want to subscribe then click on the link below ${newLink}`
			});
		});
	});

	describe('sendUpdatedEmail', () => {
		it('should call sendMail with correct parameters', async () => {
			const email = 'user@example.com';
			const repo = 'owner/repo';
			const newTag = 'v1.2.3';

			await sendUpdatedEmail(email, repo, newTag);

			expect(mockSendMail).toHaveBeenCalledWith({
				from: 'test@example.com',
				to: email,
				subject: `New release for ${repo}`,
				text: `Hi, there is a new release for ${repo} with tag ${newTag}`,
			});
		});
	});
});
