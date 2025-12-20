// pages/api/equipment/createequipment.ts
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
    console.log("=== Equipment Create Request ===");
    
    const {
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
      name: string;
      type: string;
      category?: string;
      brand?: string;
      model_number?: string;
      serial_number?: string;
      quantity: string | number;
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
      gym_id: string;
      location_id?: string;
    };

    // Convert quantity to string if it's a number (from form input)
    const quantityStr = String(quantity);

    console.log("Parsed values:", {
      name,
      type,
      category,
      quantity: quantityStr,
      gym_id,
      location_id,
    });

    if (!name || !type || !quantityStr || !gym_id) {
      console.log("Validation failed - missing required fields");
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: "Missing required fields: name, type, quantity, gym_id",
      });
    }

    // Verify gym belongs to owner
    console.log("Checking gym ownership:", { gym_id, owner_id: session.user.id });
    const gym = await prisma.gym.findFirst({
      where: {
        id: gym_id,
        owner_id: session.user.id,
        is_deleted: false,
      },
    });

    console.log("Gym found:", gym ? "Yes" : "No");

    if (!gym) {
      console.log("Gym not found or does not belong to owner");
      return res.status(StatusCodes.NOT_FOUND).json({
        error: "Gym not found or does not belong to you",
      });
    }

    // If location_id provided, verify it belongs to the gym
    if (location_id) {
      console.log("Checking location:", { location_id, gym_id });
      const location = await prisma.location.findFirst({
        where: {
          id: location_id,
          gym_id: gym_id,
          is_deleted: false,
        },
      });

      console.log("Location found:", location ? "Yes" : "No");

      if (!location) {
        console.log("Location not found or does not belong to gym");
        return res.status(StatusCodes.NOT_FOUND).json({
          error: "Location not found or does not belong to the gym",
        });
      }

      // Check equipment limit for this location
      console.log("Checking equipment limit for location:", location_id);
      const limitCheck = await checkLimitExceeded(
        session.user.id,
        "equipment",
        location_id
      );

      console.log("Limit check result:", limitCheck);

      if (limitCheck.exceeded) {
        console.log("Equipment limit exceeded");
        return res.status(StatusCodes.FORBIDDEN).json({
          error: `Equipment limit exceeded. Maximum ${limitCheck.max} equipment per location.`,
          limitExceeded: true,
          current: limitCheck.current,
          max: limitCheck.max,
        });
      }
    } else {
      console.log("No location_id provided, skipping location validation");
    }

    // Prepare data object
    const equipmentData: any = {
      name,
      type,
      quantity: quantityStr,
      gym_id,
      location_id: location_id || null,
      is_active: true,
      is_deleted: false,
    };

    // Add optional fields if provided
    if (category) equipmentData.category = category;
    if (brand) equipmentData.brand = brand;
    if (model_number) equipmentData.model_number = model_number;
    if (serial_number) equipmentData.serial_number = serial_number;
    if (min_stock_level !== undefined && min_stock_level !== "")
      equipmentData.min_stock_level = Number(min_stock_level);
    if (condition) equipmentData.condition = condition;
    if (purchase_date) equipmentData.purchase_date = new Date(purchase_date);
    if (purchase_cost !== undefined && purchase_cost !== "")
      equipmentData.purchase_cost = Number(purchase_cost);
    if (supplier_name) equipmentData.supplier_name = supplier_name;
    if (last_maintenance_date)
      equipmentData.last_maintenance_date = new Date(last_maintenance_date);
    if (next_maintenance_due)
      equipmentData.next_maintenance_due = new Date(next_maintenance_due);
    if (maintenance_notes) equipmentData.maintenance_notes = maintenance_notes;
    if (usage_frequency) equipmentData.usage_frequency = usage_frequency;
    if (equipment_location) equipmentData.equipment_location = equipment_location;
    if (status) equipmentData.status = status;
    if (weight) equipmentData.weight = weight;
    if (image_url) equipmentData.image_url = image_url;
    if (invoice_url) equipmentData.invoice_url = invoice_url;

    console.log("Creating equipment with data:", equipmentData);

    const equipment = await prisma.equipment.create({
      data: equipmentData,
    });

    console.log("Equipment created successfully:", equipment.id);
    return res.status(StatusCodes.CREATED).json({
      message: "Equipment created successfully",
      data: equipment,
    });
  } catch (err: unknown) {
    console.error("=== Equipment Create Error ===");
    console.error("Error type:", err instanceof Error ? err.constructor.name : typeof err);
    console.error("Error message:", err instanceof Error ? err.message : String(err));
    console.error("Error stack:", err instanceof Error ? err.stack : "No stack trace");

    if (err && typeof err === "object" && "code" in err) {
      console.error("Prisma error code:", (err as any).code);
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: message,
      details:
        process.env.NODE_ENV === "development"
          ? err instanceof Error
            ? err.stack
            : undefined
          : undefined,
    });
  }
}
