export interface CreateSubscriptionDto extends Partial<SubscriptionEntity> {
    email: string;
    repo: string;
}

export interface SubscriptionEntity {
    id: string;
    email: string;
    repo: string;
    confirmed: boolean;
    last_seen_tag: string;
}

export type Subscription = SubscriptionEntity;