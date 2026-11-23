import { redirect } from "next/navigation";

// Equipment is added and edited in a dialog on the Equipment page now.
export default function ManageEquipmentPage() {
  redirect("/equipment");
}
