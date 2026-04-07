import express, { urlencoded } from 'express';

import { subscriptionsRouter } from './api/subscriptions';

const app = express();
const PORT = 3000;

app.use(urlencoded({ extended: false }));

app.use('/api', subscriptionsRouter);

app.listen(PORT, () => {
	console.log(`[server]: Server is running at port: ${PORT}`);
});
