import { redirect } from "next/navigation";

// To-dos are added, ticked off and edited on the To-dos list now.
export default function ManageTodoPage() {
  redirect("/todos");
}
