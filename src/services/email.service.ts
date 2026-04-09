import nodemailer from 'nodemailer';
import SMTPPool from "nodemailer/lib/smtp-pool";

const nodemailerConfig: SMTPPool.Options = {
	host: 'mailhog', // Use the Docker service name
	port: 1025,      // The internal SMTP port
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
