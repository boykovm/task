import { prisma } from "../../lib/prisma";
import type { CreateSubscriptionDto } from "./subscription.entity";

export const create = async (data: CreateSubscriptionDto) => {
    const subscription = await prisma.subscription.create({
        data
    });

    return subscription;
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