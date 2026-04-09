import { prisma } from "../../lib/prisma";
import type { Confirmation } from "./confirmation.entity";

export const findConfirmationByEmailAndToken = async (email: string, token: string): Promise<Confirmation | null> => {
    return await prisma.confirmation.findFirst({
        where: {
            token,
            subscription: {
                email,
            }
        }
    });
}

export const confirmSubscription = async (email: string, token: string) => {
    const confirmation = await findConfirmationByEmailAndToken(email, token);

    if (!confirmation) {
        return null
        // throw new Error('Confirmation not found');
    }

    await prisma.subscription.update({
        where: {
            id: confirmation.subscriptionId,
        },
        data: {
            confirmed: true,
        }
    });

    await prisma.confirmation.delete({
        where: {
            id: confirmation.id,
        }
    });

    return confirmation.id;
}

export const confirmSubscription1 = async (confirmationId: string) => {
    const confirmation = await prisma.confirmation.findUnique({
        where: {
            id: confirmationId,
        },
        include: {
            subscription: true,
        }
    });

    if (!confirmation) {
        throw new Error('Confirmation not found');
    }

    await prisma.subscription.update({
        where: {
            id: confirmation.subscriptionId,
        },
        data: {
            confirmed: true,
        }
    });

    await prisma.confirmation.delete({
        where: {
            id: confirmationId,
        }
    });
}