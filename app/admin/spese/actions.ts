"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";

export type ExpenseActionResult = { ok: boolean; error?: string };
const idSchema = z.coerce.number().int().positive();
const optional = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const categorySchema = z.object({ name: z.string().trim().min(1).max(80), costType: z.enum(["fixed", "variable"]), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), budget: z.coerce.number().min(0).max(1000000) });
const expenseSchema = z.object({
  categoryId: idSchema, description: z.string().trim().min(1).max(160), supplier: optional(120), invoiceNumber: optional(80), expenseDate: z.iso.date(),
  amount: z.coerce.number().min(0).max(10000000), vatRate: z.coerce.number().min(0).max(100),
  accountingLabel: z.enum(["F", "X"]),
  paymentMethod: z.union([z.literal(""), z.enum(["bank_transfer", "direct_debit", "card", "cash", "other"])]).transform((value) => value || null),
  notes: optional(1000),
});
const cents = (value: number) => Math.round(value * 100);
const annualMultiplier = (frequency: "monthly" | "bimonthly" | "quarterly" | "yearly" | "custom") => ({ monthly: 12, bimonthly: 6, quarterly: 4, yearly: 1, custom: 1 })[frequency];
function done() { revalidatePath("/admin/spese"); revalidatePath("/admin"); }

export async function createExpense(formData: FormData): Promise<ExpenseActionResult> {
  const parsed = expenseSchema.safeParse({ categoryId: formData.get("category_id"), description: formData.get("description"), supplier: formData.get("supplier") ?? "", invoiceNumber: formData.get("invoice_number") ?? "", expenseDate: formData.get("expense_date"), amount: formData.get("amount"), vatRate: formData.get("vat_rate") ?? 0, accountingLabel: formData.get("accounting_label") ?? "F", paymentMethod: formData.get("payment_method") ?? "", notes: formData.get("notes") ?? "" });
  if (!parsed.success) return { ok: false, error: "Controlla i dati della spesa." };
  const { supabase } = await requireAdmin(); const value = parsed.data;
  const isInvoice=formData.get("is_invoice")==="on",netCents=cents(value.amount),vatCents=isInvoice?Math.round(netCents*value.vatRate/100):0;
  const { error } = await supabase.from("expenses").insert({ category_id: value.categoryId, description: value.description, supplier: value.supplier, invoice_number: isInvoice?value.invoiceNumber:null, is_invoice:isInvoice, accounting_label:value.accountingLabel, expense_date: value.expenseDate, due_date:null, paid_date:null, amount_net_cents:netCents, vat_cents:vatCents, payment_status:"due", payment_method:value.paymentMethod, recurrence:"none", is_estimate:false, notes:value.notes });
  if (error) return { ok: false, error: "Impossibile creare la spesa." }; done(); return { ok: true };
}

export async function updateExpense(formData: FormData): Promise<ExpenseActionResult> {
  const id = idSchema.safeParse(formData.get("id"));
  const parsed = expenseSchema.safeParse({ categoryId: formData.get("category_id"), description: formData.get("description"), supplier: formData.get("supplier") ?? "", invoiceNumber: formData.get("invoice_number") ?? "", expenseDate: formData.get("expense_date"), amount: formData.get("amount"), vatRate: formData.get("vat_rate") ?? 0, accountingLabel: formData.get("accounting_label") ?? "F", paymentMethod: formData.get("payment_method") ?? "", notes: formData.get("notes") ?? "" });
  if (!id.success || !parsed.success) return { ok: false, error: "Controlla i dati della spesa." };
  const { supabase } = await requireAdmin(); const value = parsed.data;
  const isInvoice=formData.get("is_invoice")==="on",netCents=cents(value.amount),vatCents=isInvoice?Math.round(netCents*value.vatRate/100):0;
  const { error } = await supabase.from("expenses").update({ category_id:value.categoryId,description:value.description,supplier:value.supplier,invoice_number:isInvoice?value.invoiceNumber:null,is_invoice:isInvoice,accounting_label:value.accountingLabel,expense_date:value.expenseDate,due_date:null,paid_date:null,amount_net_cents:netCents,vat_cents:vatCents,payment_status:"due",payment_method:value.paymentMethod,recurrence:"none",is_estimate:false,notes:value.notes }).eq("id", id.data);
  if (error) return { ok: false, error: "Impossibile aggiornare la spesa." }; done(); return { ok: true };
}

export async function deleteExpense(formData: FormData): Promise<ExpenseActionResult> {
  const id = idSchema.safeParse(formData.get("id")); if (!id.success) return { ok: false, error: "Spesa non valida." };
  const { supabase } = await requireAdmin(); const { error } = await supabase.from("expenses").delete().eq("id", id.data);
  if (error) return { ok: false, error: "Impossibile eliminare la spesa." }; done(); return { ok: true };
}

function categoryValues(formData: FormData) { return categorySchema.safeParse({ name: formData.get("name"), costType: formData.get("cost_type"), color: formData.get("color"), budget: formData.get("monthly_budget") }); }
export async function createExpenseCategory(formData: FormData): Promise<ExpenseActionResult> {
  const parsed = categoryValues(formData); if (!parsed.success) return { ok: false, error: "Controlla i dati della categoria." };
  const { supabase } = await requireAdmin(); const { error } = await supabase.from("expense_categories").insert({ name: parsed.data.name, cost_type: parsed.data.costType, color: parsed.data.color, monthly_budget_cents: cents(parsed.data.budget), is_active: true });
  if (error) return { ok: false, error: error.code === "23505" ? "Categoria già presente." : "Impossibile creare la categoria." }; done(); return { ok: true };
}
export async function updateExpenseCategory(formData: FormData): Promise<ExpenseActionResult> {
  const id = idSchema.safeParse(formData.get("id")); const parsed = categoryValues(formData); if (!id.success || !parsed.success) return { ok: false, error: "Controlla i dati della categoria." };
  const { supabase } = await requireAdmin(); const { error } = await supabase.from("expense_categories").update({ name: parsed.data.name, cost_type: parsed.data.costType, color: parsed.data.color, monthly_budget_cents: cents(parsed.data.budget), is_active: formData.get("is_active") === "on" }).eq("id", id.data);
  if (error) return { ok: false, error: "Impossibile aggiornare la categoria." }; done(); return { ok: true };
}

const revenueMoney = z.string().trim().min(1).transform((value) => Number(value.replace(",", "."))).pipe(z.number().finite().min(0).max(1000000));
const optionalRevenueCount = z.string().trim().transform((value) => value === "" ? null : Number(value)).pipe(z.number().int().min(0).max(100000).nullable());
const revenueSchema = z.object({
  date: z.iso.date(), drawerCount: revenueMoney, total: revenueMoney, pos: revenueMoney, issuedInvoices: revenueMoney,
  briochesCount: z.string().trim().min(1, "Inserisci il numero di brioches, anche 0 se non lo conosci.").transform(Number).pipe(z.number().int().min(0).max(100000)),
  lunchCoversCount: optionalRevenueCount,
  notes: optional(1000),
}).superRefine((value, context) => {
  if (value.pos > value.total) context.addIssue({ code: "custom", message: "Il POS non può superare la chiusura totale.", path: ["pos"] });
  const day = new Date(`${value.date}T12:00:00Z`).getUTCDay();
  if (day !== 0 && day !== 6 && value.lunchCoversCount === null) {
    context.addIssue({ code: "custom", message: "Inserisci il numero di coperti, anche 0 se non lo conosci.", path: ["lunchCoversCount"] });
  }
});

export async function saveDailyRevenue(formData: FormData): Promise<ExpenseActionResult> {
  const parsed = revenueSchema.safeParse({ date: formData.get("revenue_date"), drawerCount: formData.get("drawer_count"), total: formData.get("total"), pos: formData.get("pos"), issuedInvoices: formData.get("issued_invoices") ?? "0", briochesCount: formData.get("brioches_count") ?? "", lunchCoversCount: formData.get("lunch_covers_count") ?? "", notes: formData.get("notes") ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Controlla i dati dell'incasso." };
  const { supabase } = await requireAdmin(); const value = parsed.data;
  const expenseCategories = formData.getAll("cash_expense_category");
  const expenseAmounts = formData.getAll("cash_expense_amount");
  if (expenseCategories.length !== expenseAmounts.length) return { ok: false, error: "Controlla le spese inserite nella chiusura." };
  const cashExpenses: { category: "personale" | "materie_prime" | "altro"; amount_cents: number }[] = [];
  for (let index = 0; index < expenseAmounts.length; index += 1) {
    const rawAmount = String(expenseAmounts[index] ?? "").trim();
    if (!rawAmount) continue;
    const category = z.enum(["personale", "materie_prime", "altro"]).safeParse(expenseCategories[index]);
    const amount = revenueMoney.safeParse(rawAmount);
    if (!category.success || !amount.success) return { ok: false, error: "Controlla categoria e importo delle spese inserite." };
    cashExpenses.push({ category: category.data, amount_cents: cents(amount.data) });
  }
  const { error } = await supabase.from("daily_revenues").upsert({ revenue_date: value.date, cash_cents: cents(value.total - value.pos), pos_cents: cents(value.pos), other_cents: cents(value.drawerCount), refunds_cents: 0, receipt_count: null, issued_invoices_cents: cents(value.issuedInvoices), cash_expenses: cashExpenses, brioches_count: value.briochesCount, lunch_covers_count: value.lunchCoversCount, notes: value.notes, is_closed: false, closed_at: null }, { onConflict: "revenue_date" });
  if (error) return { ok: false, error: "Impossibile salvare l'incasso giornaliero." }; done(); return { ok: true };
}

export async function deleteDailyRevenue(formData: FormData): Promise<ExpenseActionResult> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Incasso non valido." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("daily_revenues").delete().eq("id", id.data);
  if (error) return { ok: false, error: "Impossibile eliminare l'incasso giornaliero." };
  done(); return { ok: true };
}

const planSchema = z.object({
  name: z.string().trim().min(1).max(120), categoryId: z.union([z.literal(""), idSchema]).transform((value) => value === "" ? null : value),
  supplier: optional(120), annualAmount: z.union([z.literal(""), z.coerce.number().min(0).max(10000000)]).transform((value) => value === "" ? null : value),
  start: z.iso.date(), end: z.union([z.literal(""), z.iso.date()]).transform((value) => value || null), frequency: z.enum(["monthly","bimonthly","quarterly","yearly","custom"]),
  day: z.coerce.number().int().min(1).max(28), accountingLabel: z.enum(["F","X"]), method: z.union([z.literal(""), z.enum(["bank_transfer","direct_debit","card","cash","other"])]).transform((value) => value || null), notes: optional(1000),
}).refine((value) => value.end === null || value.end >= value.start, { message: "La data finale non può precedere quella iniziale.", path: ["end"] });

function planValues(formData: FormData) {
  const parsed = planSchema.safeParse({ name: formData.get("name"), categoryId: formData.get("category_id") ?? "", supplier: formData.get("supplier") ?? "", annualAmount: formData.get("annual_amount") ?? "", start: formData.get("competence_start"), end: formData.get("competence_end"), frequency: formData.get("payment_frequency"), day: formData.get("payment_day"), accountingLabel: formData.get("accounting_label") ?? "F", method: formData.get("payment_method") ?? "", notes: formData.get("notes") ?? "" });
  if (!parsed.success) return parsed;
  const months = formData.getAll("payment_months").map(Number).filter((month) => month >= 1 && month <= 12);
  return { ...parsed, data: { ...parsed.data, months } };
}

export async function createRecurringPlan(formData: FormData): Promise<ExpenseActionResult> {
  const parsed = planValues(formData); if (!parsed.success) return { ok: false, error: "Controlla i dati del costo fisso." };
  const { supabase } = await requireAdmin(); const v = parsed.data;
  const { data: closedPeriod } = await supabase.from("financial_period_closures").select("id").eq("period_type","month").eq("period_start",`${v.start.slice(0,7)}-01`).maybeSingle();
  if (closedPeriod) return { ok:false,error:"Il mese selezionato è chiuso. Riaprilo prima di aggiungere un costo." };
  const periodAmountCents = v.annualAmount === null ? null : cents(v.annualAmount); const annualCents = periodAmountCents === null ? null : periodAmountCents * annualMultiplier(v.frequency);
  const { data: plan, error } = await supabase.from("recurring_cost_plans").insert({ category_id: v.categoryId, name: v.name, supplier: v.supplier, annual_amount_cents: annualCents, accounting_label:v.accountingLabel, competence_start: v.start, competence_end: v.end, payment_frequency: v.frequency, payment_months: v.months, payment_day: v.day, payment_method: v.method, is_estimate: formData.get("is_estimate") === "on", is_active: true, notes: v.notes }).select("id").single();
  if (error || !plan) return { ok: false, error: "Impossibile creare il costo fisso." };
  const start = new Date(`${v.start.slice(0, 7)}-01T12:00:00Z`); const end = new Date(`${(v.end ?? "9999-12-31").slice(0, 7)}-01T12:00:00Z`); const rows = []; let index = 0;
  for (const cursor = new Date(start); cursor <= end && index < 120; cursor.setUTCMonth(cursor.getUTCMonth() + 1), index++) { const key = cursor.toISOString().slice(0, 10); const monthNumber = cursor.getUTCMonth() + 1; const isPayment = v.months.includes(monthNumber) && annualCents !== null; rows.push({ plan_id: plan.id, competence_month: key, competence_amount_cents: annualCents === null ? null : Math.floor(annualCents / 12) + (index < annualCents % 12 ? 1 : 0), due_date: isPayment ? `${key.slice(0,8)}${String(v.day).padStart(2,"0")}` : null, cash_amount_cents: isPayment ? periodAmountCents : null }); }
  if (rows.length) { const { error: rowsError } = await supabase.from("cost_plan_months").insert(rows); if (rowsError) return { ok: false, error: "Costo creato, ma calendario non generato." }; }
  done(); return { ok: true };
}

export async function updateRecurringPlan(formData: FormData): Promise<ExpenseActionResult> {
  const id = idSchema.safeParse(formData.get("id")); const parsed = planValues(formData); if (!id.success || !parsed.success) return { ok: false, error: "Controlla i dati del costo fisso." };
  const { supabase } = await requireAdmin(); const v = parsed.data;
  const normalizedAnnualCents = v.annualAmount === null ? null : cents(v.annualAmount) * annualMultiplier(v.frequency);
  const periodAmountCents = v.annualAmount === null ? null : cents(v.annualAmount);
  const { data: current, error: currentError } = await supabase.from("recurring_cost_plans").select("id,series_id,version_number,competence_start,competence_end").eq("id",id.data).single();
  if (currentError || !current) return { ok:false,error:"Costo fisso non trovato." };
  const { data: closedPeriods } = await supabase.from("financial_period_closures").select("period_start").eq("period_type","month");
  const closedMonths = new Set((closedPeriods ?? []).map((period) => period.period_start));
  if (closedMonths.has(`${v.start.slice(0,7)}-01`)) return {ok:false,error:"Il mese selezionato è chiuso. Riaprilo prima di modificare il costo."};
  const common = { category_id:v.categoryId,name:v.name,supplier:v.supplier,annual_amount_cents:normalizedAnnualCents,accounting_label:v.accountingLabel,payment_frequency:v.frequency,payment_months:v.months,payment_day:v.day,payment_method:v.method,is_estimate:formData.get("is_estimate")==="on",notes:v.notes };
  if (v.start <= current.competence_start) {
    const { error } = await supabase.from("recurring_cost_plans").update({...common,competence_start:v.start,competence_end:v.end,is_active:formData.get("is_active")==="on"}).eq("id",id.data);
    if(error)return{ok:false,error:"Impossibile aggiornare il costo fisso."};
    const {data:months}=await supabase.from("cost_plan_months").select("id,competence_month,status").eq("plan_id",id.data).order("competence_month");
    await Promise.all((months??[]).filter(row=>!closedMonths.has(row.competence_month)).map((row,index)=>{const monthNumber=Number(row.competence_month.slice(5,7));const isPayment=v.months.includes(monthNumber)&&normalizedAnnualCents!==null;return supabase.from("cost_plan_months").update({competence_amount_cents:normalizedAnnualCents===null?null:Math.floor(normalizedAnnualCents/12)+(index<normalizedAnnualCents%12?1:0),due_date:isPayment?`${row.competence_month.slice(0,8)}${String(v.day).padStart(2,"0")}`:null,cash_amount_cents:isPayment?periodAmountCents:null,status:"planned",confirmed_at:null,confirmed_by:null}).eq("id",row.id)}));
    const existingMonths=new Set((months??[]).map(row=>row.competence_month));
    const start=new Date(`${v.start.slice(0,7)}-01T12:00:00Z`),end=new Date(`${(v.end??"9999-12-31").slice(0,7)}-01T12:00:00Z`),missing=[];let index=0;
    for(const cursor=new Date(start);cursor<=end&&index<120;cursor.setUTCMonth(cursor.getUTCMonth()+1),index++){const key=cursor.toISOString().slice(0,10);if(existingMonths.has(key))continue;const monthNumber=cursor.getUTCMonth()+1,isPayment=v.months.includes(monthNumber)&&normalizedAnnualCents!==null;missing.push({plan_id:id.data,competence_month:key,competence_amount_cents:normalizedAnnualCents===null?null:Math.floor(normalizedAnnualCents/12)+(index<normalizedAnnualCents%12?1:0),due_date:isPayment?`${key.slice(0,8)}${String(v.day).padStart(2,"0")}`:null,cash_amount_cents:isPayment?periodAmountCents:null});}
    if(missing.length)await supabase.from("cost_plan_months").insert(missing);
    done();return{ok:true};
  }
  const previousEnd=new Date(`${v.start.slice(0,7)}-01T12:00:00Z`);previousEnd.setUTCDate(previousEnd.getUTCDate()-1);
  const {data:newPlan,error:newError}=await supabase.from("recurring_cost_plans").insert({...common,series_id:current.series_id,version_number:Number(current.version_number)+1,competence_start:`${v.start.slice(0,7)}-01`,competence_end:v.end,is_active:true}).select("id").single();
  if(newError||!newPlan)return{ok:false,error:"Impossibile creare la nuova versione del costo."};
  const {error:deleteError}=await supabase.from("cost_plan_months").delete().eq("plan_id",id.data).eq("status","planned").gte("competence_month",`${v.start.slice(0,7)}-01`);
  if(deleteError)return{ok:false,error:"Nuova versione creata, ma il periodo precedente è bloccato. Riapri il mese interessato."};
  await supabase.from("recurring_cost_plans").update({competence_end:previousEnd.toISOString().slice(0,10),is_active:false,replaced_at:new Date().toISOString(),replaced_by:newPlan.id}).eq("id",id.data);
  const start=new Date(`${v.start.slice(0,7)}-01T12:00:00Z`),end=new Date(`${(v.end??"9999-12-31").slice(0,7)}-01T12:00:00Z`),rows=[];let index=0;
  for(const cursor=new Date(start);cursor<=end&&index<120;cursor.setUTCMonth(cursor.getUTCMonth()+1),index++){const key=cursor.toISOString().slice(0,10),monthNumber=cursor.getUTCMonth()+1,isPayment=v.months.includes(monthNumber)&&normalizedAnnualCents!==null;rows.push({plan_id:newPlan.id,competence_month:key,competence_amount_cents:normalizedAnnualCents===null?null:Math.floor(normalizedAnnualCents/12)+(index<normalizedAnnualCents%12?1:0),due_date:isPayment?`${key.slice(0,8)}${String(v.day).padStart(2,"0")}`:null,cash_amount_cents:isPayment?periodAmountCents:null});}
  if(rows.length){const {error}=await supabase.from("cost_plan_months").insert(rows);if(error)return{ok:false,error:"Versione creata, ma competenze non generate."};}
  done();return{ok:true};
}

export async function validateCostMonth(formData: FormData): Promise<ExpenseActionResult> {
  const id = idSchema.safeParse(formData.get("id")); const amount = z.coerce.number().min(0).max(10000000).safeParse(formData.get("amount"));
  if (!id.success || !amount.success) return { ok: false, error: "Importo non valido." };
  const { supabase,profile } = await requireAdmin(); const paid = formData.get("status") === "paid";
  const { error } = await supabase.from("cost_plan_months").update({ competence_amount_cents: cents(amount.data), status: paid ? "paid" : "confirmed", paid_date: paid ? String(formData.get("paid_date") || new Date().toISOString().slice(0,10)) : null, confirmed_at:new Date().toISOString(),confirmed_by:profile.id }).eq("id", id.data);
  if (error) return { ok: false, error: "Impossibile validare il consuntivo." }; done(); return { ok: true };
}

export async function closeFinancialMonth(formData:FormData):Promise<ExpenseActionResult>{const month=z.string().regex(/^\d{4}-\d{2}$/).safeParse(formData.get("month"));if(!month.success)return{ok:false,error:"Mese non valido."};const {supabase,profile}=await requireAdmin();const start=`${month.data}-01`;const {error:updateError}=await supabase.from("cost_plan_months").update({status:"confirmed",confirmed_at:new Date().toISOString(),confirmed_by:profile.id}).eq("competence_month",start).eq("status","planned");if(updateError)return{ok:false,error:"Impossibile confermare le competenze del mese."};const {error}=await supabase.from("financial_period_closures").upsert({period_type:"month",period_start:start,closed_by:profile.id,notes:"Chiusura mensile amministrativa"},{onConflict:"period_type,period_start"});if(error)return{ok:false,error:"Impossibile chiudere il mese."};done();return{ok:true};}
export async function reopenFinancialMonth(formData:FormData):Promise<ExpenseActionResult>{const month=z.string().regex(/^\d{4}-\d{2}$/).safeParse(formData.get("month"));if(!month.success)return{ok:false,error:"Mese non valido."};const {supabase}=await requireAdmin();const {error}=await supabase.from("financial_period_closures").delete().eq("period_type","month").eq("period_start",`${month.data}-01`);if(error)return{ok:false,error:"Impossibile riaprire il mese."};done();return{ok:true};}
