import { PrismaClient } from '@/prisma/generated/client'
import { PrismaPg } from '@prisma/adapter-pg'

const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! })

/**
 * Fields left out of every query result unless a query asks for them, so they
 * can't leak into API responses through `include: { user: true }` and the like.
 * Code that genuinely needs one must opt in, e.g. `omit: { password: false }`
 * or `select: { password: true }` (sign-in and change-password only).
 */
export const GLOBAL_OMIT = {
  user: { password: true },
} as const

const prisma = new PrismaClient({ adapter: pool, omit: GLOBAL_OMIT })

const globalForPrisma = global as unknown as { prisma: typeof prisma }

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
