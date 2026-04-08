import { type Request, type Response } from "express";
import {create} from "../models/subscription";

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

        const subscription = await create({ email, repo })
        console.log(subscription.id)

        res.send('subscribe!')
    } catch (error) {
        console.error(error)
        res.status(500).send('Internal Server Error')
    }
}