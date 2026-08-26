import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { ExpenseDashboard } from "./expense-dashboard";

export default async function ExpensesPage() {
  let context;
  try { context = await requireAdmin(); } catch { redirect("/admin"); }
  const [categoriesResult, expensesResult, plansResult, planMonthsResult, revenuesResult, staffCostsResult, closuresResult] = await Promise.all([
    context.supabase.from("expense_categories").select("id, name, cost_type, color, monthly_budget_cents, is_active").order("cost_type").order("name"),
    context.supabase.from("expenses").select("id, category_id, description, supplier, invoice_number, expense_date, due_date, paid_date, amount_net_cents, vat_cents, total_cents, payment_status, payment_method, recurrence, is_estimate, notes").order("expense_date", { ascending: false }),
    context.supabase.from("recurring_cost_plans").select("id, category_id, name, supplier, annual_amount_cents, competence_start, competence_end, payment_frequency, payment_months, payment_day, payment_method, is_estimate, is_active, notes, series_id, version_number, replaced_at, replaced_by").order("name").order("version_number", { ascending: false }),
    context.supabase.from("cost_plan_months").select("id, plan_id, competence_month, competence_amount_cents, due_date, cash_amount_cents, status, paid_date, notes, confirmed_at").order("competence_month"),
    context.supabase.from("daily_revenues").select("id, revenue_date, cash_cents, pos_cents, other_cents, refunds_cents, receipt_count, notes, is_closed").order("revenue_date", { ascending: false }),
    context.supabase.from("employee_monthly_costs").select("id, competence_month, confirmed_base_hours, confirmed_extra_hours, base_hourly_rate_cents, extra_hourly_rate_cents, status"),
    context.supabase.from("financial_period_closures").select("id, period_start, closed_at, notes").eq("period_type", "month").order("period_start", { ascending: false }),
  ]);
  if (categoriesResult.error || expensesResult.error) throw new Error("Impossibile caricare le spese. Hai eseguito expenses-setup.sql su Supabase?");
  const financeReady = !plansResult.error && !planMonthsResult.error && !revenuesResult.error;
  return <ExpenseDashboard categories={categoriesResult.data ?? []} expenses={expensesResult.data ?? []} plans={plansResult.data ?? []} planMonths={planMonthsResult.data ?? []} revenues={revenuesResult.data ?? []} staffCosts={staffCostsResult.data ?? []} closures={closuresResult.data ?? []} historyReady={!closuresResult.error && !plansResult.error} financeReady={financeReady} />;
}
