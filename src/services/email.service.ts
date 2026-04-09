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
	transporter.sendMail({
		from: 'test@example.com',
		to: email,
		subject: 'Local Docker Email',
		text: 'It works!'
	});
}
