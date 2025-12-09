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