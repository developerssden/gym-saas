// Phone-number search for members. Owners type numbers the way they say them
// ("0301 84", "+92 301-84", "92301"), while phones are stored in different
// formats (E.164 "+92301…" from the form, "0301…" from imports). Comparing
// digits only, without the national 0 or international 00, finds them all.
import prisma from "@/lib/prisma";
import { Prisma } from "@/prisma/generated/client";

const MAX_MATCHES = 200;

export { phoneSearchDigits } from "@/lib/members/phone-digits";

/**
 * Ids of members whose phone contains any of `digits` (ignoring formatting),
 * limited to one owner's gyms when `ownerId` is given (null = super admin).
 */
export async function memberIdsMatchingPhone(digits: string[], ownerId: string | null): Promise<string[]> {
  if (digits.length === 0) return [];
  const matches = digits.map(d => Prisma.sql`regexp_replace(coalesce(u.phone_number, ''), '[^0-9]', '', 'g') LIKE ${`%${d}%`}`);
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT m.id
    FROM "Member" m
    JOIN "User" u ON u.id = m.user_id
    JOIN "Gym" g ON g.id = m.gym_id
    WHERE (${Prisma.join(matches, " OR ")})
    ${ownerId ? Prisma.sql`AND g.owner_id = ${ownerId}` : Prisma.empty}
    LIMIT ${MAX_MATCHES}
  `);
  return rows.map(r => r.id);
}
