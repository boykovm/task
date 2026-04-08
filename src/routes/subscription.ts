import { Router } from "express";
import { confirmSubscription, createSubscription, getSubscriptions, unsubscribe } from "../controllers/subscription";

const subscriptionsRouter = Router()

subscriptionsRouter.get('/confirm/:token', confirmSubscription)

subscriptionsRouter.post('/subscribe', createSubscription);

subscriptionsRouter.get('/subscriptions', getSubscriptions)

subscriptionsRouter.get('/unsubscribe/:token', unsubscribe)

export default subscriptionsRouter