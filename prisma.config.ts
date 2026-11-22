import { defineConfig, env } from 'prisma/config'
import 'dotenv/config'

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        // Used by `prisma db seed` / `npm run db:seed`. Creates the dev super admin.
        seed: 'tsx ./prisma/seed.ts',
    },
    datasource: {
        url: env('DATABASE_URL'),
    },
})
