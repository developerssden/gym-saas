// Type representing a Subscription row
export type Subscription = {
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
    ownerSubscriptions?: any[] // optional if you want owner count
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
    subscription_id?: string | null;
    billing_model?: string | null; // or BillingModel enum if imported
    next_payment_date?: Date | null;
    is_active: boolean;
    is_deleted: boolean;
    createdAt: Date;
    updatedAt: Date;

    // relations
    subscription?: Subscription | null;
    ownerSubscriptions?: any[];
};
