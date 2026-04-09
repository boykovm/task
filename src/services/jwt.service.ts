import jwt, { type SignOptions, type JwtPayload } from 'jsonwebtoken';
import type { ConfirmationAction } from "../../generated/prisma/enums";

const SECRET_KEY = process.env.JWT_SECRET || 'your-very-secure-secret';

interface SubscriptionPayload extends JwtPayload {
    email: string;
    token: string;
    action: ConfirmationAction;
}

const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: '24H'
};

export const generateToken = (email: string, token: string, action: ConfirmationAction) => {
    return jwt.sign({ email, token, action }, SECRET_KEY, options);
}

export const verifyToken = (token: string) => {
    return jwt.verify(token, SECRET_KEY) as SubscriptionPayload;
}
