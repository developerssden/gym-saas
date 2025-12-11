// pages/api/subscription/createSubscription.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireSuperAdmin } from "@/lib/adminsessioncheck";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST")
        return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

    const session = await requireSuperAdmin(req, res);
    if (!session) return;

    try {
        const {
            first_name,
            last_name,
            phone_number,
            address,
            city,
            state,
            zip_code,
            country,
            date_of_birth,
            cnic,
            email,
            password,
        } = req.body;

        const client = await prisma.user.create({
            data: {
                first_name,
                last_name,
                phone_number,
                address,
                city,
                state,
                zip_code,
                country,
                date_of_birth,
                cnic,
                email,
                password,
                role: "GYM_OWNER",

            },
        });

        return res.status(StatusCodes.CREATED).json(client);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return res
            .status(StatusCodes.INTERNAL_SERVER_ERROR)
            .json({ error: message });
    }
}
