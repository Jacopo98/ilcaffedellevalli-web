import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Bell, LayoutDashboard, LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { createAuthClient } from "@/lib/supabase/auth-server";

export const metadata: Metadata = {
  title: "Amministrazione | Il Caffè delle Valli",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/area-riservata");
  let unreadNotifications = 0;
  if (profile.role === "admin") {
    const supabase = await createAuthClient();
    const { count } = await supabase.from("admin_notifications").select("id", { count: "exact", head: true }).eq("is_read", false);
    unreadNotifications = count ?? 0;
  }

  return (
    <div className="min-h-dvh bg-cream text-ink">
      <header className="admin-header">
        <Link className="admin-brand" href="/admin"><Image src="/Logo_black_trasparent.png" alt="Il Caffè delle Valli" width={2843} height={820} /><span><LayoutDashboard size={14} /> Dashboard</span></Link>
        <div className="flex items-center gap-4">
          {profile.role === "admin" && <Link className="admin-notification-link" href="/admin/notifiche" aria-label={`${unreadNotifications} notifiche da leggere`}><Bell size={19} />{unreadNotifications > 0 && <span>{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}</Link>}
          <div className="hidden text-right sm:block"><p className="text-sm font-semibold text-white">{profile.displayName || profile.email}</p><p className="text-xs capitalize text-white/45">{profile.role}</p></div>
          <form action={logout}><button className="admin-logout" type="submit" aria-label="Esci"><LogOut size={17} /><span className="hidden sm:inline">Esci</span></button></form>
        </div>
      </header>
      {children}
    </div>
  );
}
