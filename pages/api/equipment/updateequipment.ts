// pages/api/equipment/updateequipment.ts
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { StatusCodes } from "http-status-codes";
import { requireGymOwner } from "@/lib/ownersessioncheck";
import { checkLimitExceeded } from "@/lib/subscription-validation";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(StatusCodes.METHOD_NOT_ALLOWED).json({ message: "Method not allowed" });

  const session = await requireGymOwner(req, res);
  if (!session) return;

  try {
    const {
      id,
      name,
      type,
      category,
      brand,
      model_number,
      serial_number,
      quantity,
      min_stock_level,
      condition,
      purchase_date,
      purchase_cost,
      supplier_name,
      last_maintenance_date,
      next_maintenance_due,
      maintenance_notes,
      usage_frequency,
      equipment_location,
      status,
      weight,
      image_url,
      invoice_url,
      gym_id,
      location_id,
    } = req.body as {
      id: string;
      name?: string;
      type?: string;
      category?: string;
      brand?: string;
      model_number?: string;
      serial_number?: string;
      quantity?: string | number;
      min_stock_level?: number | string;
      condition?: string;
      purchase_date?: string;
      purchase_cost?: number | string;
      supplier_name?: string;
      last_maintenance_date?: string;
      next_maintenance_due?: string;
      maintenance_notes?: string;
      usage_frequency?: string;
      equipment_location?: string;
      status?: string;
      weight?: string;
      image_url?: string;
      invoice_url?: string;
      gym_id?: string;
      location_id?: string;
    };

    if (!id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required field: id",
      });
    }

    // Verify equipment belongs to owner
    const existing = await prisma.equipment.findFirst({
      where: {
        id,
        is_deleted: false,
        gym: {
          owner_id: session.user.id,
          is_deleted: false,
        },
      },
    });

    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "Equipment not found",
      });
    }

    // If location_id is being changed, check limit
    const finalLocationId = location_id !== undefined ? location_id : existing.location_id;
    if (finalLocationId && location_id !== existing.location_id) {
      const limitCheck = await checkLimitExceeded(
        session.user.id,
        "equipment",
        finalLocationId
      );

      if (limitCheck.exceeded) {
        return res.status(StatusCodes.FORBIDDEN).json({
          error: `Equipment limit exceeded. Maximum ${limitCheck.max} equipment per location.`,
          limitExceeded: true,
          current: limitCheck.current,
          max: limitCheck.max,
        });
      }
    }

    // If gym_id is being changed, verify it belongs to owner
    if (gym_id && gym_id !== existing.gym_id) {
      const gym = await prisma.gym.findFirst({
        where: {
          id: gym_id,
          owner_id: session.user.id,
          is_deleted: false,
        },
      });

      if (!gym) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Gym not found or does not belong to you",
        });
      }
    }

    // If location_id is provided, verify it belongs to the gym
    const finalGymId = gym_id || existing.gym_id;
    if (finalLocationId) {
      const location = await prisma.location.findFirst({
        where: {
          id: finalLocationId,
          gym_id: finalGymId,
          is_deleted: false,
        },
      });

      if (!location) {
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Location not found or does not belong to the gym",
        });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (category !== undefined) updateData.category = category || null;
    if (brand !== undefined) updateData.brand = brand || null;
    if (model_number !== undefined) updateData.model_number = model_number || null;
    if (serial_number !== undefined) updateData.serial_number = serial_number || null;
    if (quantity !== undefined) updateData.quantity = String(quantity);
    if (min_stock_level !== undefined)
      updateData.min_stock_level = min_stock_level === "" ? null : Number(min_stock_level);
    if (condition !== undefined) updateData.condition = condition || null;
    if (purchase_date !== undefined)
      updateData.purchase_date = purchase_date ? new Date(purchase_date) : null;
    if (purchase_cost !== undefined)
      updateData.purchase_cost = purchase_cost === "" ? null : Number(purchase_cost);
    if (supplier_name !== undefined) updateData.supplier_name = supplier_name || null;
    if (last_maintenance_date !== undefined)
      updateData.last_maintenance_date = last_maintenance_date
        ? new Date(last_maintenance_date)
        : null;
    if (next_maintenance_due !== undefined)
      updateData.next_maintenance_due = next_maintenance_due
        ? new Date(next_maintenance_due)
        : null;
    if (maintenance_notes !== undefined) updateData.maintenance_notes = maintenance_notes || null;
    if (usage_frequency !== undefined) updateData.usage_frequency = usage_frequency || null;
    if (equipment_location !== undefined)
      updateData.equipment_location = equipment_location || null;
    if (status !== undefined) updateData.status = status;
    if (weight !== undefined) updateData.weight = weight || null;
    if (image_url !== undefined) updateData.image_url = image_url || null;
    if (invoice_url !== undefined) updateData.invoice_url = invoice_url || null;
    if (gym_id !== undefined) updateData.gym_id = gym_id;
    if (location_id !== undefined) updateData.location_id = location_id || null;

    const updated = await prisma.equipment.update({
      where: { id },
      data: updateData,
    });

    return res.status(StatusCodes.OK).json({
      message: "Equipment updated successfully",
      data: updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
