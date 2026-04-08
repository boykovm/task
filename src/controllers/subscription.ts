import { type Request, type Response } from "express";
import { type PrismaClientKnownRequestError } from "../../generated/prisma/internal/prismaNamespace";

import { create, getSubscriptionsByEmail } from "../models/subscription";
import { isRepoExists } from "../utils/github";

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

        if (errors.length) {
            return res.status(400).send(errors.join(', '))
        }

        if (!(await isRepoExists(repo))) {
            return res.status(404).send('Repository not found on GitHub')
        }

        const subscription = await create({ email, repo })
        console.log(subscription.id)

        res.send('subscribe!')
    } catch (error) {
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

        if (token != 'qwe') {
            return res.status(404).send('Token not found')
        }

        res.status(200).send('Subscription confirmed successfully')
    } catch (error) {
        console.error(error)
        res.status(500).send('Internal Server Error')
    }
}

export const unsubscribe = async (req: Request, res: Response) => {
    try {
        const { token = '' } = req.params

        if (!token) {
            return res.status(400).send('Invalid token')
        }

        if (token != 'qwe') {
            return res.status(404).send('Token not found')
        }

        res.status(200).send('Unsubscribed successfully')
    } catch (error) {
        console.error(error)
        res.status(500).send('Internal Server Error')
    }
}

export const getSubscriptions = async (req: Request, res: Response) => {
    try {
        const { email = '' } = req.query

        if (!email || Array.isArray(email) || typeof email !== 'string') {
            return res.status(400).send('Invalid email')
        }

        const subscriptions = await getSubscriptionsByEmail(email)

        res.status(200).send(subscriptions)


    } catch (error) {
        console.error(error)
        res.status(500).send('Internal Server Error')
    }
}