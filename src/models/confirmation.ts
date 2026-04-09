import { prisma } from "../../lib/prisma";
import type { Confirmation } from "./confirmation.entity";
import { ConfirmationAction } from "../../generated/prisma/enums";
import { generateToken } from "../services/jwt.service";

export const findConfirmation = async (email: string, token: string, action: ConfirmationAction): Promise<Confirmation | null> => {
    return await prisma.confirmation.findFirst({
        where: {
            token,
            action,
            subscription: {
                email,
            },
        }
    });
}

export const confirmSubscription = async (email: string, repo: string, token: string) => {
    const confirmation = await findConfirmation(email, token, ConfirmationAction.SUBSCRIBE);

    if (!confirmation) {
        return null
    }

    const newToken = generateToken(email, repo, ConfirmationAction.UNSUBSCRIBE);

    await prisma.confirmation.update({
        where: {
            id: confirmation.id,
        },
        data: {
            action: ConfirmationAction.UNSUBSCRIBE,
            token: newToken,
            subscription: {
                update: {
                    data: {
                        confirmed: true,
                    }
                }
            }
        }
    })

    return newToken;
}

export const unsubscribeFromSubscription = async (email: string, repo: string, token: string) => {
    const confirmation = await findConfirmation(email, token, ConfirmationAction.UNSUBSCRIBE);

    if (!confirmation) {
        return null
    }

    const newToken = generateToken(email, repo, ConfirmationAction.SUBSCRIBE);

    await prisma.subscription.update({
        where: {
            id: confirmation.subscriptionId,
        },
        data: {
            confirmed: false,
            confirmations: {
                update: {
                    where: {
                        id: confirmation.id
                    },
                    data: {
                        action: ConfirmationAction.SUBSCRIBE,
                        token: newToken
                    }
                }
            }
        }
    });

    return newToken;
}
