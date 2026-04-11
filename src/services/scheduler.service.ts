import cron from 'node-cron';

export class SchedulerService {
    public static init() {
        // Runs every day at midnight (0 0 * * *)
        cron.schedule('0 0 * * *', async () => {
            try {
                await this.performDailyCleanup();
            } catch (error) {
                console.error('Cleanup failed:', error);
            }
        });

        // add scheduler to run every 15 minutes
        // cron.schedule('*/15 * * * *', async () => {
        cron.schedule('*/1 * * * *', async () => {
            try {
                await this.doSomething();
            } catch (error) {
                console.error('every 15 min:', error);
            }
        })
    }

    private static async doSomething() {
        console.log('Executing doSomething logic...');
    }

    private static async performDailyCleanup() {
        console.log('Executing daily cleanup logic...');
        // Add your database cleanup or report generation here
    }
}

// Initialize in your main app file
SchedulerService.init();
