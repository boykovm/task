export interface ConfirmationEntity {
    id: string;
    token: string;
    subscriptionId: string;
}

export type Confirmation = ConfirmationEntity