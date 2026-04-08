import {type Request, type Response, Router} from "express";
import {createSubscription} from "../controllers/subscription";

const subscriptionsRouter = Router()

subscriptionsRouter.post('/subscribe', createSubscription);

subscriptionsRouter.get('/confirm/:token', (req: Request, res: Response) => {
    res.send('confirm/:token!')
})

subscriptionsRouter.get('/unsubscribe/:token', (req: Request, res: Response) => {
    res.send('unsubscribe/:token!')
})

subscriptionsRouter.get('/subscriptions', (req: Request, res: Response) => {
    res.send('subscriptions!')
})

export default subscriptionsRouter