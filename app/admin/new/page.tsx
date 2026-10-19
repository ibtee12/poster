import { redirect } from "next/navigation";

export default function NewTemplatePage() {
  redirect("/admin?mode=new");
}
