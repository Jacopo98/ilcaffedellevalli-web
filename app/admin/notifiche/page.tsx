import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { NotificationCenter } from "./notification-center";

export default async function NotificationsPage() {
  let context;
  try { context = await requireAdmin(); } catch { redirect("/admin"); }
  const [notifications, preference] = await Promise.all([
    context.supabase.from("admin_notifications").select("id,kind,title,message,due_date,priority,is_read,created_at").order("is_read").order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(200),
    context.supabase.from("profiles").select("email,receive_email_notifications").eq("id", context.profile.id).single(),
  ]);
  return <NotificationCenter notifications={notifications.data ?? []} setupReady={!notifications.error} email={context.profile.email} emailEnabled={preference.data?.receive_email_notifications ?? false} emailPreferenceReady={!preference.error} />;
}
