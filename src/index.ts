import express, { Request, Response } from 'express';

const app = express();
const PORT = 3000;

app.get('/', (req: Request, res: Response) => {
	res.send('Express + TypeScript Server');
});

app.listen(PORT, () => {
	console.log(`[server]: Server is running at port: ${PORT}`);
});
