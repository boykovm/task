import cron from 'node-cron';
import {
    getAllSubscribedRepos,
    getEmailsListByRepoAndTagAndUpdateTag
} from "../models/subscription";
import { getUpdatedTag } from "./github.service";
import { sendUpdatedEmail } from "./email.service";



export class SchedulerService {
    private static isPreviousTaskEnded = true;

    public static init() {
        cron.schedule('*/15 * * * *', () => this.watcher());
    }

    private static async watcher(){
        if (!this.isPreviousTaskEnded) {
            return;
        }

        this.isPreviousTaskEnded = false;

        try {
            const watchList = await getAllSubscribedRepos();
            const updatedTags = await getUpdatedTag(watchList);
            updatedTags.map(async (el) => {
                const emails = await getEmailsListByRepoAndTagAndUpdateTag(el.repo, el.last_seen_tag, el.newTag);
                emails.map(async (email) => {
                    await sendUpdatedEmail(email.email, el.repo, el.newTag);
                })
            })
            console.log(updatedTags);
        } catch (error) {
            console.error('every 15 min:', error);
        } finally {
            this.isPreviousTaskEnded = true;
        }
    };
}
