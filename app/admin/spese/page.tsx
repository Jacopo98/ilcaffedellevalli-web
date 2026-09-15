import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { ExpenseDashboard } from "./expense-dashboard";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ closing?: string }> }) {
  let context;
  try { context = await requireAdmin(); } catch { redirect("/admin"); }
  const [categoriesResult, expensesResult, plansResult, planMonthsResult, revenuesResult, employeeContractsResult, closuresResult] = await Promise.all([
    context.supabase.from("expense_categories").select("id, name, cost_type, color, monthly_budget_cents, is_active").order("cost_type").order("name"),
    context.supabase.from("expenses").select("id, category_id, description, supplier, invoice_number, is_invoice, expense_date, due_date, paid_date, amount_net_cents, vat_cents, total_cents, payment_status, payment_method, recurrence, is_estimate, notes").order("expense_date", { ascending: false }),
    context.supabase.from("recurring_cost_plans").select("id, category_id, name, supplier, annual_amount_cents, competence_start, competence_end, payment_frequency, payment_months, payment_day, payment_method, is_estimate, is_active, notes, series_id, version_number, replaced_at, replaced_by").order("name").order("version_number", { ascending: false }),
    context.supabase.from("cost_plan_months").select("id, plan_id, competence_month, competence_amount_cents, due_date, cash_amount_cents, status, paid_date, notes, confirmed_at").order("competence_month"),
    context.supabase.from("daily_revenues").select("id, revenue_date, cash_cents, pos_cents, other_cents, refunds_cents, receipt_count, brioches_count, lunch_covers_count, notes, is_closed").order("revenue_date", { ascending: false }),
    context.supabase.from("employees").select("id, first_name, last_name, ral_cents, contract_start, contract_end, is_active"),
    context.supabase.from("financial_period_closures").select("id, period_start, closed_at, notes").eq("period_type", "month").order("period_start", { ascending: false }),
  ]);
  if (categoriesResult.error || expensesResult.error) throw new Error("Impossibile caricare le spese. Hai eseguito expenses-setup.sql su Supabase?");
  if (revenuesResult.error) throw new Error("Impossibile caricare gli incassi. Esegui daily-service-metrics-migration.sql su Supabase.");
  const financeReady = !plansResult.error && !planMonthsResult.error && !revenuesResult.error;
  const plans = (plansResult.data ?? []).filter((plan) => plan.name.trim().toLocaleLowerCase("it-IT") !== "stipendi dipendenti");
  const visiblePlanIds = new Set(plans.map((plan) => plan.id));
  const planMonths = (planMonthsResult.data ?? []).filter((row) => visiblePlanIds.has(row.plan_id));
  const { closing } = await searchParams;
  return <ExpenseDashboard categories={categoriesResult.data ?? []} expenses={expensesResult.data ?? []} plans={plans} planMonths={planMonths} revenues={revenuesResult.data ?? []} employeeContracts={employeeContractsResult.data ?? []} closures={closuresResult.data ?? []} historyReady={!closuresResult.error && !plansResult.error} financeReady={financeReady} openDailyClosing={closing === "1"} />;
}
