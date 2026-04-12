import nodemailer from 'nodemailer';
import SMTPPool from "nodemailer/lib/smtp-pool";
import { ConfirmationAction } from "../../generated/prisma/enums";

const nodemailerConfig: SMTPPool.Options = {
	host: process.env.SMTP_HOST || 'mailhog',
	port: Number.parseInt(process.env.SMTP_PORT ?? '') || 1025,
	secure: false,   // Usually false for local development
	auth: undefined,       // Most local test servers don't require auth by default
	pool: true,
}

const transporter = nodemailer.createTransport(nodemailerConfig);

export const sendEmail = async (email: string) => {
	await transporter.sendMail({
		from: 'test@example.com',
		to: email,
		subject: 'Local Docker Email',
		text: 'It works!'
	});
}

export const sendConfirmationEmail = async (email: string, token: string) => {
	const convertedToken = Buffer.from(token).toString('base64url');

	const confirmationLink = `http://localhost:3000/api/confirm/${convertedToken}`;

	await transporter.sendMail({
		from: 'test@example.com',
		to: email,
		subject: 'Confirm your subscription',
		text: `Please click on the link below to confirm your subscription: ${confirmationLink}`
	});
}

export const sendUpdateEmail = async (email: string, token: string, repo: string, action: string) => {
	const convertedToken = Buffer.from(token).toString('base64url');

	const newLink = action === ConfirmationAction.SUBSCRIBE ? `http://localhost:3000/api/unsubscribe/${convertedToken}` : `http://localhost:3000/api/confirm/${convertedToken}`;

	const status = action === ConfirmationAction.SUBSCRIBE ? 'unsubscribed' : 'subscribed';

	const actionText = action === ConfirmationAction.SUBSCRIBE ? 'unsubscribe' : 'subscribe';

	await transporter.sendMail({
		from: 'test@example.com',
		to: email,
		subject: 'Your subscription was updated',
		text: `Your subscription for ${repo} was updated to ${status} status. If you want to ${actionText} then click on the link below ${newLink}`
	});
}

export const sendUpdatedEmail = async (email: string, repo: string, newTag: string) => {
	await transporter.sendMail({
		from: 'test@example.com',
		to: email,
		subject: `New release for ${repo}`,
		text: `Hi, there is a new release for ${repo} with tag ${newTag}`,
	})
}

export const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
