import { prisma } from "../../lib/prisma";
import type { CreateSubscriptionDto } from "./subscription.entity";
import { generateToken } from "../services/jwt.service";

export const create = async (data: CreateSubscriptionDto) => {
    const token = generateToken(data.email, data.repo);

    const subscription = await prisma.subscription.create({
        data: {
            ...data,
            confirmations: {
                create: {
                    token,
                }
            }
        }
    });

    return {
        subscription,
        token,
    } ;
}

export const getSubscriptionsByEmail = async (email: string)=> {
    return await prisma.subscription.findMany({
        where: {
            email
        },
        omit: {
            id: true,
        }
    })
}