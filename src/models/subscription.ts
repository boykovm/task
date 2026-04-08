import { prisma } from "../../lib/prisma";
import type { CreateSubscriptionDto } from "./subscription.entity";

export const create = async (data: CreateSubscriptionDto) => {
    const subscription = await prisma.subscription.create({
        data
    });

    return subscription;
}