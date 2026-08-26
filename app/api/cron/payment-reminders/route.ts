import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
const safe = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char]!);

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  const supabase = createServiceClient();
  const today = new Date();
  const until = new Date(today);
  until.setUTCDate(until.getUTCDate() + 7);
  const from = today.toISOString().slice(0, 10);
  const to = until.toISOString().slice(0, 10);
  const [expenses, plans] = await Promise.all([
    supabase.from("expenses").select("id,description,due_date,total_cents").neq("payment_status", "paid").gte("due_date", from).lte("due_date", to),
    supabase.from("cost_plan_months").select("id,due_date,cash_amount_cents,recurring_cost_plans(name)").neq("status", "paid").gte("due_date", from).lte("due_date", to),
  ]);
  if (expenses.error || plans.error) return Response.json({ error: "Query failed" }, { status: 500 });
  const items = [
    ...(expenses.data ?? []).map((entry) => ({ key: `expense-${entry.id}-${entry.due_date}`, title: entry.description, date: entry.due_date!, amount: entry.total_cents })),
    ...(plans.data ?? []).map((entry) => ({ key: `plan-${entry.id}-${entry.due_date}`, title: (entry.recurring_cost_plans as unknown as { name: string } | null)?.name ?? "Costo ricorrente", date: entry.due_date!, amount: entry.cash_amount_cents ?? 0 })),
  ];
  for (const item of items) await supabase.from("admin_notifications").upsert({ kind: "payment_due", title: `Pagamento in scadenza: ${item.title}`, message: `Importo previsto: ${(item.amount / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}`, due_date: item.date, priority: "high", fingerprint: item.key }, { onConflict: "fingerprint", ignoreDuplicates: true });
  if (!items.length) return Response.json({ ok: true, count: 0 });
  if (!process.env.RESEND_API_KEY || !process.env.REMINDER_EMAIL_FROM) return Response.json({ ok: true, count: items.length, email: "not-configured" });

  const { data: optedInAdmins } = await supabase.from("profiles").select("email").eq("role", "admin").eq("receive_email_notifications", true);
  const recipients = [...new Set(["info@ilcaffedellevalli.it", ...(optedInAdmins ?? []).map((profile) => profile.email).filter(Boolean)])];
  const fingerprint = items.map((item) => item.key).sort().join("|");
  const { data: existingLogs } = await supabase.from("notification_email_log").select("recipient").eq("sent_date", from).eq("fingerprint", fingerprint).in("recipient", recipients);
  const alreadySent = new Set((existingLogs ?? []).map((log) => log.recipient));
  const pendingRecipients = recipients.filter((recipient) => !alreadySent.has(recipient));
  if (!pendingRecipients.length) return Response.json({ ok: true, count: items.length, email: "already-sent" });

  const rows = items.map((item) => `<tr><td style="padding:8px">${safe(item.date)}</td><td style="padding:8px">${safe(item.title)}</td><td style="padding:8px;text-align:right">${safe((item.amount / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" }))}</td></tr>`).join("");
  const html = `<div style="font-family:Arial;color:#1C1C1A"><h1>Scadenze della settimana</h1><p>Pagamenti previsti dal ${safe(from)} al ${safe(to)}.</p><table style="width:100%;border-collapse:collapse">${rows}</table></div>`;
  for (const recipient of pendingRecipients) {
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `payment-reminders-${from}-${Buffer.from(recipient).toString("base64url")}` }, body: JSON.stringify({ from: process.env.REMINDER_EMAIL_FROM, to: [recipient], subject: `Scadenze pagamenti entro 7 giorni · ${items.length}`, html }) });
    if (!response.ok) return Response.json({ error: "Email failed", recipient, details: await response.text() }, { status: 502 });
    await supabase.from("notification_email_log").insert({ sent_date: from, fingerprint, recipient });
  }
  return Response.json({ ok: true, count: items.length, email: "sent", recipients: pendingRecipients.length });
}
