import { ConfirmationAction } from "../../generated/prisma/enums";

export interface CreateSubscriptionDto extends Partial<SubscriptionEntity> {
    email: string;
    repo: string;
    last_seen_tag: string
}

export interface SubscriptionEntity {
    id: string;
    email: string;
    repo: string;
    confirmed: boolean;
    last_seen_tag: string;
    action: ConfirmationAction;
}

export type Subscription = SubscriptionEntity;