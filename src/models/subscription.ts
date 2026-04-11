import { prisma } from "../../lib/prisma";
import type { CreateSubscriptionDto } from "./subscription.entity";
import { generateToken } from "../services/jwt.service";
import { ConfirmationAction } from "../../generated/prisma/enums";

export const create = async (data: CreateSubscriptionDto) => {
    const token = generateToken(data.email, data.repo, ConfirmationAction.SUBSCRIBE);

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

export const getAllSubscribedRepos = async () => {
    return await prisma.subscription.findMany({
        where: {
            confirmed: true
        },
        select: {
            repo: true,
            last_seen_tag: true,
        },
        distinct: ["repo"]
    })
}

export const getEmailsListByRepoAndTagAndUpdateTag = async (repo: string, last_seen_tag: string, newTag: string) => {
    return await prisma.subscription.updateManyAndReturn({
        select: {
            email: true,
        },
        where: {
            repo,
            confirmed: true
        },
        data: {
            last_seen_tag: newTag
        }
    })
}
