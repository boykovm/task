import express, { type Request, type Response, Router, urlencoded } from 'express';

// import subscriptionsRouter from './routes/subscription';
//
const app = express();
const port = 3000;

app.get('/', (req: Request, res: Response) => {
    res.send('Hello World!1')
})
//
// app.use(urlencoded({ extended: false }));
//
// app.use('/api', subscriptionsRouter);
//
app.listen(port, () => {
	console.log(`[server]: Server is running at port: ${port}`);
});
