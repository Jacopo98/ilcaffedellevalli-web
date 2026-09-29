import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { NotificationCenter } from "./notification-center";

export default async function NotificationsPage() {
  let context;
  try { context = await requireAdmin(); } catch { redirect("/admin"); }
  const [notifications, preference] = await Promise.all([
    context.supabase.from("admin_notifications").select("id,kind,title,message,due_date,remind_on,reminder_days,email_reminder,priority,is_read,archived_at,created_at").order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(500),
    context.supabase.from("profiles").select("email,receive_email_notifications").eq("id", context.profile.id).single(),
  ]);
  return <NotificationCenter notifications={notifications.data ?? []} setupReady={!notifications.error} email={context.profile.email} emailEnabled={preference.data?.receive_email_notifications ?? false} emailPreferenceReady={!preference.error} />;
}
