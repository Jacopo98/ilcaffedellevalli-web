"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";

export type RebalanceSegment={entryType:"work"|"extra";startTime:string;endTime:string;breakMinutes:number};
export type RebalanceChange={shiftId:number;employeeId:number;employeeName:string;date:string;weekStart:string;entryType:"work"|"extra";startTime:string;endTime:string;breakMinutes:number;segments:RebalanceSegment[]};
export type RebalanceSummary={employeeId:number;employeeName:string;weekStart:string;contractHours:number;totalHours:number;beforeRegular:number;afterRegular:number;beforeExtra:number;afterExtra:number};
export type RebalanceProposal={month:string;changes:RebalanceChange[];summaries:RebalanceSummary[];warnings:string[]};
export type RebalanceResult={ok:boolean;error?:string;proposal?:RebalanceProposal;message?:string};

const monthSchema=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const idsSchema=z.array(z.number().int().positive()).min(1).max(100);
const minutes=(value:string)=>{const [h,m]=value.slice(0,5).split(":").map(Number);return h*60+m};
const time=(value:number)=>`${String(Math.floor(value/60)).padStart(2,"0")}:${String(value%60).padStart(2,"0")}`;
const iso=(date:Date)=>date.toISOString().slice(0,10);
const addDays=(value:string,days:number)=>{const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return iso(date)};
const monday=(value:string)=>{const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));return iso(date)};
const duration=(shift:{start_time:string;end_time:string;break_minutes:number})=>minutes(shift.end_time)-minutes(shift.start_time)-shift.break_minutes;

export async function buildShiftRebalance(month:string,employeeIds:number[]):Promise<RebalanceResult>{
  const parsedMonth=monthSchema.safeParse(month),parsedIds=idsSchema.safeParse(employeeIds);
  if(!parsedMonth.success||!parsedIds.success)return{ok:false,error:"Seleziona un mese e almeno un dipendente."};
  const {supabase}=await requireAdmin();
  const monthStart=`${month}-01`;const nextMonth=new Date(`${monthStart}T12:00:00Z`);nextMonth.setUTCMonth(nextMonth.getUTCMonth()+1);const monthEnd=addDays(iso(nextMonth),-1);const rangeStart=monday(monthStart);const rangeEnd=addDays(monday(monthEnd),6);
  const [{data:employees,error:employeeError},{data:shifts,error:shiftError}]=await Promise.all([
    supabase.from("employees").select("id,first_name,last_name,contract_type,weekly_contract_hours").in("id",parsedIds.data),
    supabase.from("work_shifts").select("id,employee_id,entry_type,shift_date,start_time,end_time,actual_start_time,actual_end_time,break_minutes,approval_status").in("employee_id",parsedIds.data).in("entry_type",["work","extra"]).eq("approval_status","approved").gte("shift_date",rangeStart).lte("shift_date",rangeEnd).order("shift_date").order("start_time"),
  ]);
  if(employeeError||shiftError)return{ok:false,error:"Impossibile analizzare i turni selezionati."};
  const changes:RebalanceChange[]=[],summaries:RebalanceSummary[]=[],warnings:string[]=[];
  for(const employee of employees??[]){
    const employeeName=`${employee.first_name} ${employee.last_name}`.trim();
    if(employee.contract_type==="on_call"){warnings.push(`${employeeName}: escluso perché ha un contratto a chiamata.`);continue}
    const contractMinutes=Math.floor(Number(employee.weekly_contract_hours??0)*2)*30;
    if(contractMinutes<=0){warnings.push(`${employeeName}: ore settimanali contrattuali non valorizzate.`);continue}
    const employeeShifts=(shifts??[]).filter(shift=>shift.employee_id===employee.id);
    for(let week=rangeStart;week<=rangeEnd;week=addDays(week,7)){
      const weekEnd=addDays(week,6);const weekly=employeeShifts.filter(shift=>shift.shift_date>=week&&shift.shift_date<=weekEnd);
      const inside=weekly.filter(shift=>shift.shift_date>=monthStart&&shift.shift_date<=monthEnd);
      if(!inside.length)continue;
      if(inside.some(shift=>shift.actual_start_time||shift.actual_end_time)){warnings.push(`${employeeName}, settimana ${week}: contiene orari effettivi già registrati e non è stata modificata.`);continue}
      if(inside.some(shift=>duration(shift)<=0||duration(shift)%30!==0)){warnings.push(`${employeeName}, settimana ${week}: contiene durate non multiple di 30 minuti e non è stata modificata.`);continue}
      const outsideRegular=weekly.filter(shift=>shift.shift_date<monthStart||shift.shift_date>monthEnd).filter(shift=>shift.entry_type==="work").reduce((sum,shift)=>sum+duration(shift),0);
      const availableRegular=Math.max(0,contractMinutes-outsideRegular);
      const days=[...new Set(inside.map(shift=>shift.shift_date))].sort().map(date=>{const dayShifts=inside.filter(shift=>shift.shift_date===date);const total=dayShifts.reduce((sum,shift)=>sum+duration(shift),0);return{date,shifts:dayShifts,total,extra:Math.max(0,total-480)}});
      const totalMinutes=days.reduce((sum,day)=>sum+day.total,0);const mandatoryExtra=days.reduce((sum,day)=>sum+day.extra,0);const targetExtra=Math.max(mandatoryExtra,totalMinutes-availableRegular);
      let remaining=targetExtra-mandatoryExtra;
      while(remaining>=30){const candidates=days.filter(day=>day.extra+30<=day.total).sort((a,b)=>(a.extra/Math.max(1,a.total))-(b.extra/Math.max(1,b.total))||a.date.localeCompare(b.date));if(!candidates.length)break;candidates[0].extra+=30;remaining-=30}
      for(const day of days){let normalRemaining=day.total-day.extra;for(const shift of day.shifts){const net=duration(shift);const normal=Math.min(normalRemaining,net);normalRemaining-=normal;const segments:RebalanceSegment[]=[];if(normal===net)segments.push({entryType:"work",startTime:shift.start_time.slice(0,5),endTime:shift.end_time.slice(0,5),breakMinutes:shift.break_minutes});else if(normal===0)segments.push({entryType:"extra",startTime:shift.start_time.slice(0,5),endTime:shift.end_time.slice(0,5),breakMinutes:shift.break_minutes});else{const split=minutes(shift.start_time)+shift.break_minutes+normal;segments.push({entryType:"work",startTime:shift.start_time.slice(0,5),endTime:time(split),breakMinutes:shift.break_minutes},{entryType:"extra",startTime:time(split),endTime:shift.end_time.slice(0,5),breakMinutes:0})}
        const unchanged=segments.length===1&&segments[0].entryType===shift.entry_type&&segments[0].startTime===shift.start_time.slice(0,5)&&segments[0].endTime===shift.end_time.slice(0,5)&&segments[0].breakMinutes===shift.break_minutes;
        if(!unchanged)changes.push({shiftId:shift.id,employeeId:employee.id,employeeName,date:shift.shift_date,weekStart:week,entryType:shift.entry_type as "work"|"extra",startTime:shift.start_time.slice(0,5),endTime:shift.end_time.slice(0,5),breakMinutes:shift.break_minutes,segments});
      }}
      const beforeRegular=inside.filter(shift=>shift.entry_type==="work").reduce((sum,shift)=>sum+duration(shift),0);const beforeExtra=totalMinutes-beforeRegular;const afterExtra=days.reduce((sum,day)=>sum+day.extra,0);
      summaries.push({employeeId:employee.id,employeeName,weekStart:week,contractHours:contractMinutes/60,totalHours:totalMinutes/60,beforeRegular:beforeRegular/60,afterRegular:(totalMinutes-afterExtra)/60,beforeExtra:beforeExtra/60,afterExtra:afterExtra/60});
    }
  }
  return{ok:true,proposal:{month,changes,summaries,warnings}};
}

export async function applyShiftRebalance(proposal:RebalanceProposal):Promise<RebalanceResult>{
  if(!proposal?.changes?.length)return{ok:false,error:"La proposta non contiene modifiche da applicare."};
  const {supabase}=await requireAdmin();const {data,error}=await supabase.rpc("apply_shift_rebalance",{p_changes:proposal.changes});
  if(error)return{ok:false,error:error.message||"Impossibile applicare la proposta. Esegui shift-rebalance-migration.sql."};
  revalidatePath("/admin/dipendenti");revalidatePath("/admin/dipendenti/report");return{ok:true,message:`Riordino applicato a ${Number(data)||proposal.changes.length} turni.`};
}
