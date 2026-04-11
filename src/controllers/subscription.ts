import { type Request, type Response } from "express";
import { type PrismaClientKnownRequestError } from "../../generated/prisma/internal/prismaNamespace";

import { create, getSubscriptionsByEmail } from "../models/subscription";
import { getReleaseTagByRepo, isRepoExists } from "../services/github.service";
import { isValidEmail, sendConfirmationEmail, sendUpdateEmail } from "../services/email.service";
import { verifyToken } from "../services/jwt.service";
import {
    confirmSubscription as confirmSubscriptionByEmailAndToken, unsubscribeFromSubscription,
} from "../models/confirmation";
import { ConfirmationAction } from "../../generated/prisma/enums";

export const createSubscription = async (req: Request, res: Response) => {
    try {
        if (!req.body) {
            return res.status(400).send('Invalid input')
        }

        const { email = '', repo = '' } = req.body

        const errors: string[] = []

        if (!email.length) {
            errors.push('Email is required')
        }

        if (!repo.length) {
            errors.push('Repository is required')
        }

        if (!isValidEmail(email)) {
            errors.push('Email is invalid')
        }

        if (repo.split('/').length !== 2) {
            errors.push('Repository must be in the format "owner/repo"')
        }

        const [owner = '', repoName = ''] = repo.split('/').map((el: string) => el.trim())

        if (!owner.length || !repoName.length) {
            errors.push('Repository must be in the format "owner/repo"')
        }

        if (errors.length) {
            return res.status(400).send(errors.join(', '))
        }

        if (!(await isRepoExists(owner, repoName))) {
            return res.status(404).send('Repository not found on GitHub')
        }

        const tag = await getReleaseTagByRepo(`${owner}/${repoName}`)

        const { token } = await create({ email, repo, last_seen_tag: tag })

        await sendConfirmationEmail(email, token).catch(e => console.error(e))

        res.send('Subscription successful. Confirmation email sent.')
    } catch (error) {
        // todo: add rollback logic
        if (error instanceof Error && error.name === 'PrismaClientKnownRequestError' && (error as PrismaClientKnownRequestError).code === 'P2002') {
                return res.status(409).send('Email already subscribed to this repository')
        }

        console.error(error)
        res.status(500).send('Internal Server Error')
    }
}

export const confirmSubscription = async (req: Request, res: Response) => {
    try {
        const { token = '' } = req.params

        if (!token) {
            return res.status(400).send('Invalid token')
        }

        const decodedToken = Buffer.from(token as string, 'base64url').toString('utf-8');

        let data;

        try {
            data = verifyToken(decodedToken)

            if (data.action !== ConfirmationAction.SUBSCRIBE) {
                return res.status(400).send('Invalid token')
            }
        } catch (error) {
            return res.status(400).send('Invalid token')
        }


        const newToken = await confirmSubscriptionByEmailAndToken(data.email, data.repo, decodedToken)

        if (!newToken) {
            return res.status(404).send('Token not found')
        }

        await sendUpdateEmail(data.email, newToken, data.repo, ConfirmationAction.SUBSCRIBE)
            .catch(e => console.error(e))

        res.status(200).send('Subscription confirmed successfully')
    } catch (error) {
        // todo: add rollback logic
        res.status(500).send('Internal Server Error')
    }
}

export const unsubscribe = async (req: Request, res: Response) => {
    try {
        const { token = '' } = req.params

        if (!token) {
            return res.status(400).send('Invalid token')
        }

        const decodedToken = Buffer.from(token as string, 'base64url').toString('utf-8');

        let data;

        try {
            data = verifyToken(decodedToken)

            if (data.action !== ConfirmationAction.UNSUBSCRIBE) {
                return res.status(400).send('Invalid token')
            }
        } catch (error) {
            return res.status(400).send('Invalid token')
        }

        const newToken = await unsubscribeFromSubscription(data.email, data.repo, decodedToken)

        if (!newToken) {
            return res.status(404).send('Token not found')
        }

        await sendUpdateEmail(data.email, newToken, data.repo, ConfirmationAction.UNSUBSCRIBE)
            .catch(e => console.error(e))

        res.status(200).send('Unsubscribed successfully')
    } catch (error) {
        // todo: add rollback logic
        console.error(error)
        res.status(500).send('Internal Server Error')
    }
}

export const getSubscriptions = async (req: Request, res: Response) => {
    try {
        const { email = '' } = req.query

        if (!email || Array.isArray(email) || typeof email !== 'string' || !isValidEmail(email)) {
            return res.status(400).send('Invalid email')
        }

        const subscriptions = await getSubscriptionsByEmail(email)

        res.status(200).send(subscriptions)
    } catch (error) {
        // todo: add rollback logic
        console.error(error)
        res.status(500).send('Internal Server Error')
    }
}
