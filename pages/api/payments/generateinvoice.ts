// pages/api/payments/generateinvoice.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";
import { SubscriptionTypeEnum } from "@/prisma/generated/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const { payment_id } = req.body;

    if (!payment_id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Payment ID is required",
      });
    }

    // Get payment with related subscription data
    const payment = await prisma.payment.findUnique({
      where: { id: payment_id },
      include: {
        ownerSubscription: {
          include: {
            plan: true,
            owner: true,
          },
        },
        memberSubscription: {
          include: {
            member: {
              include: {
                user: true,
                gym: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "Payment not found",
      });
    }

    // Build invoice data
    let invoiceData: any = {
      payment: {
        id: payment.id,
        amount: payment.amount,
        payment_method: payment.payment_method,
        transaction_id: payment.transaction_id,
        payment_date: payment.payment_date,
        notes: payment.notes,
      },
    };

    if (payment.subscription_type === SubscriptionTypeEnum.OWNER && payment.ownerSubscription) {
      const sub = payment.ownerSubscription;
      invoiceData = {
        ...invoiceData,
        subscription: {
          type: "OWNER",
          plan_name: sub.plan.name,
          billing_model: sub.billing_model,
          start_date: sub.start_date,
          end_date: sub.end_date,
        },
        customer: {
          name: `${sub.owner.first_name} ${sub.owner.last_name}`,
          email: sub.owner.email,
          phone: sub.owner.phone_number,
          address: sub.owner.address,
          city: sub.owner.city,
          state: sub.owner.state,
          zip_code: sub.owner.zip_code,
          country: sub.owner.country,
        },
      };
    } else if (payment.subscription_type === SubscriptionTypeEnum.MEMBER && payment.memberSubscription) {
      const sub = payment.memberSubscription;
      invoiceData = {
        ...invoiceData,
        subscription: {
          type: "MEMBER",
          billing_model: sub.billing_model,
          price: sub.price,
          start_date: sub.start_date,
          end_date: sub.end_date,
        },
        customer: {
          name: `${sub.member.user.first_name} ${sub.member.user.last_name}`,
          email: sub.member.user.email,
          phone: sub.member.user.phone_number,
          gym_name: sub.member.gym.name,
        },
      };
    }

    return res.status(StatusCodes.OK).json({
      invoice: invoiceData,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: message });
  }
}


