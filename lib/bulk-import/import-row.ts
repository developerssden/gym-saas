import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/authHelper";
import { PaymentMethod, SubscriptionTypeEnum } from "@/prisma/generated/client";
import type { ImportMode, ValidatedImportRow } from "./types";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function generateImportEmail(phone: string, gymId: string): string {
  const normalized = normalizePhone(phone) || "member";
  const gymSlice = gymId.replace(/-/g, "").slice(0, 8);
  return `${normalized}@import.${gymSlice}.local`;
}

async function checkPhoneDuplicateAtLocation(
  phone: string,
  locationId: string
): Promise<boolean> {
  const existing = await prisma.member.findFirst({
    where: {
      location_id: locationId,
      user: {
        phone_number: phone,
        is_deleted: false,
      },
    },
  });
  return !!existing;
}

export async function importMemberRow(
  row: ValidatedImportRow,
  mode: ImportMode,
  gymId: string,
  locationId: string,
  recordedById: string
): Promise<string> {
  const email = row.email || generateImportEmail(row.phone_number, gymId);

  const existingUser = await prisma.user.findFirst({
    where: { email, is_deleted: false },
  });
  if (existingUser) {
    throw new Error(`Email already exists: ${email}`);
  }

  const phoneTaken = await checkPhoneDuplicateAtLocation(
    row.phone_number,
    locationId
  );
  if (phoneTaken) {
    throw new Error(
      `Phone number already registered at this location: ${row.phone_number}`
    );
  }

  const memberId = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        first_name: row.first_name,
        last_name: row.last_name,
        email,
        phone_number: row.phone_number,
        address: row.address || "",
        city: row.city || "",
        state: row.state || "",
        zip_code: row.zip_code || "",
        country: row.country || "",
        date_of_birth: row.date_of_birth ?? new Date(),
        cnic: row.cnic,
        role: "MEMBER",
        password: await hashPassword(Math.random().toString(36).slice(-12)),
      },
    });

    const member = await tx.member.create({
      data: {
        user_id: user.id,
        gym_id: gymId,
        location_id: locationId,
      },
    });

    if (mode === "member_with_subscription" && row.price && row.start_date && row.end_date) {
      const paymentMethod =
        (row.payment_method as PaymentMethod) || PaymentMethod.CASH;
      const transactionId =
        paymentMethod === PaymentMethod.BANK_TRANSFER
          ? row.transaction_id
          : row.transaction_id ||
            `CASH-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

      const memberSubscription = await tx.memberSubscription.create({
        data: {
          member_id: member.id,
          price: row.price,
          billing_model: "MONTHLY",
          start_date: row.start_date,
          end_date: row.end_date,
          is_expired: false,
          is_active: true,
        },
      });

      await tx.payment.create({
        data: {
          member_subscription_id: memberSubscription.id,
          subscription_type: SubscriptionTypeEnum.MEMBER,
          amount: row.price,
          payment_method: paymentMethod,
          transaction_id: transactionId,
          payment_date: row.payment_date ?? row.start_date,
          notes: "Bulk import",
          recorded_by_id: recordedById,
        },
      });
    }

    return member.id;
  });

  return memberId;
}
