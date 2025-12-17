// Type representing a Plan row
export type Plan = {
    id: string
    name: string
    monthly_price: number
    yearly_price: number
    max_gyms: number
    max_members: number
    max_equipment: number
    is_active: boolean
    is_deleted: boolean
    createdAt: Date
    updatedAt: Date
    ownerSubscriptions?: OwnerSubscription[] // optional if you want owner count
}

export type OwnerSubscription = {
    id: string
    owner_id: string
    plan_id: string
    billing_model: string // BillingModel enum
    start_date: Date
    end_date: Date
    is_expired: boolean
    notification_sent: boolean
    is_active: boolean
    is_deleted: boolean
    createdAt: Date
    updatedAt: Date
    owner?: Client
    plan?: Plan
    payments?: Payment[]
}

export type MemberSubscription = {
    id: string
    member_id: string
    price: number
    billing_model: string // BillingModel enum
    start_date: Date
    end_date: Date
    is_expired: boolean
    notification_sent: boolean
    is_active: boolean
    is_deleted: boolean
    createdAt: Date
    updatedAt: Date
    member?: any
    payments?: Payment[]
}

export type Payment = {
    id: string
    owner_subscription_id?: string | null
    member_subscription_id?: string | null
    subscription_type: string // SubscriptionTypeEnum
    amount: number
    payment_method: string // PaymentMethod enum
    transaction_id?: string | null
    payment_date: Date
    notes?: string | null
    createdAt: Date
    updatedAt: Date
    ownerSubscription?: OwnerSubscription
    memberSubscription?: MemberSubscription
}

export type Client = {
    id: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
    date_of_birth: Date;
    cnic?: string | null;
    profile_picture?: string | null;
    email?: string | null;
    password?: string | null;
    role: string; // or Role enum if you're importing Role from Prisma
    is_active: boolean;
    is_deleted: boolean;
    createdAt: Date;
    updatedAt: Date;

    // relations
    ownerSubscriptions?: OwnerSubscription[];
};
