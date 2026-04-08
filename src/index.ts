import express, { type Request, type Response, urlencoded } from 'express';

import subscriptionsRouter from './routes/subscription';
import { prisma } from "../lib/prisma";

const app = express();
const port = 3000;

app.get('/', (req: Request, res: Response) => {
    res.send('Hello World!1')
})

app.use(urlencoded({ extended: false }));

app.use('/api', subscriptionsRouter);

async function main() {
    try {
        await prisma.$connect().then(() => {
            console.log('[server]: Server is connected to DB');
        })
        app.listen(port, () => {
            console.log(`[server]: Server is running at port: ${port}`);
        });
    } catch (error) {
        console.error(error)
    } finally {
        await prisma.$disconnect()
    }
}

main();
