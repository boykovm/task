// import {Request, Response, Router} from "express";
//
// const subscriptionsRouter = Router()
//
// subscriptionsRouter.post('/subscribe', (req: Request, res: Response) => {
//     console.log(req.body);
//
//     try {
//         if (!req.body) {
//             return res.status(400).send('Invalid input')
//         }
//
//         const { email = '', repo = '' } = req.body
//
//         const errors: string[] = []
//
//         if (!email.length) {
//             errors.push('Email is required')
//         }
//
//         if (!repo.length) {
//             errors.push('Repository is required')
//         }
//
//         if (errors.length) {
//             return res.status(400).send(errors.join(', '))
//         }
//
//         res.send('subscribe!')
//     } catch (error) {
//         console.error(error)
//         res.status(500).send('Internal Server Error')
//     }
// })
//
// subscriptionsRouter.get('/confirm/:token', (req: Request, res: Response) => {
//     res.send('confirm/:token!')
// })
//
// subscriptionsRouter.get('/unsubscribe/:token', (req: Request, res: Response) => {
//     res.send('unsubscribe/:token!')
// })
//
// subscriptionsRouter.get('/subscriptions', (req: Request, res: Response) => {
//     res.send('subscriptions!')
// })
//
// export default subscriptionsRouter