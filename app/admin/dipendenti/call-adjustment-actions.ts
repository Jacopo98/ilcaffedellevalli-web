"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import type { RebalanceChange, RebalanceSegment } from "./rebalance-actions";

export type CallAdjustmentSummary={employeeId:number;employeeName:string;date:string;totalHours:number;beforeWork:number;beforeExtra:number;afterWork:number;afterExtra:number;convertedHours:number};
export type CallAdjustmentProposal={from:string;to:string;employeeIds:number[];changes:RebalanceChange[];summaries:CallAdjustmentSummary[];warnings:string[]};
export type CallAdjustmentResult={ok:boolean;error?:string;proposal?:CallAdjustmentProposal;message?:string};

const dateSchema=z.iso.date();
const idsSchema=z.array(z.number().int().positive()).min(1).max(100);
const minutes=(value:string)=>{const [hour,minute]=value.slice(0,5).split(":").map(Number);return hour*60+minute};
const time=(value:number)=>`${String(Math.floor(value/60)).padStart(2,"0")}:${String(value%60).padStart(2,"0")}`;
const duration=(shift:{start_time:string;end_time:string;break_minutes:number})=>Math.max(0,minutes(shift.end_time)-minutes(shift.start_time)-shift.break_minutes);

export async function buildCallAdjustment(from:string,to:string,employeeIds:number[]):Promise<CallAdjustmentResult>{
  const parsedFrom=dateSchema.safeParse(from),parsedTo=dateSchema.safeParse(to),parsedIds=idsSchema.safeParse(employeeIds);
  if(!parsedFrom.success||!parsedTo.success||!parsedIds.success||to<from)return{ok:false,error:"Periodo o dipendenti non validi."};
  const {supabase}=await requireAdmin();
  const [{data:employees,error:employeeError},{data:shifts,error:shiftError}]=await Promise.all([
    supabase.from("employees").select("id,first_name,last_name,contract_type").in("id",parsedIds.data).eq("contract_type","on_call").eq("is_active",true),
    supabase.from("work_shifts").select("id,employee_id,entry_type,shift_date,start_time,end_time,actual_start_time,actual_end_time,break_minutes,approval_status").in("employee_id",parsedIds.data).in("entry_type",["work","extra"]).eq("approval_status","approved").gte("shift_date",from).lte("shift_date",to).order("shift_date").order("start_time"),
  ]);
  if(employeeError||shiftError)return{ok:false,error:"Impossibile analizzare i turni delle chiamate."};
  const changes:RebalanceChange[]=[],summaries:CallAdjustmentSummary[]=[],warnings:string[]=[];
  for(const employee of employees??[]){
    const employeeName=`${employee.first_name} ${employee.last_name}`.trim();const employeeShifts=(shifts??[]).filter(shift=>shift.employee_id===employee.id);const dates=[...new Set(employeeShifts.map(shift=>shift.shift_date))].sort();
    for(const date of dates){
      const daily=employeeShifts.filter(shift=>shift.shift_date===date);const total=daily.reduce((sum,shift)=>sum+duration(shift),0);if(total<60)continue;
      const beforeWork=daily.filter(shift=>shift.entry_type==="work").reduce((sum,shift)=>sum+duration(shift),0);const beforeExtra=total-beforeWork;
      if(daily.some(shift=>shift.actual_start_time||shift.actual_end_time)){warnings.push(`${employeeName}, ${date}: orari effettivi già presenti; giornata non modificata.`);summaries.push({employeeId:employee.id,employeeName,date,totalHours:total/60,beforeWork:beforeWork/60,beforeExtra:beforeExtra/60,afterWork:beforeWork/60,afterExtra:beforeExtra/60,convertedHours:0});continue;}
      let remaining=Math.min(120,beforeExtra),converted=0;
      for(const shift of daily.filter(item=>item.entry_type==="extra")){
        if(remaining<=0)break;const net=duration(shift),normal=Math.min(remaining,net);if(normal<=0)continue;const segments:RebalanceSegment[]=[];
        if(normal===net)segments.push({entryType:"work",startTime:shift.start_time.slice(0,5),endTime:shift.end_time.slice(0,5),breakMinutes:shift.break_minutes});
        else{const split=minutes(shift.start_time)+shift.break_minutes+normal;segments.push({entryType:"work",startTime:shift.start_time.slice(0,5),endTime:time(split),breakMinutes:shift.break_minutes},{entryType:"extra",startTime:time(split),endTime:shift.end_time.slice(0,5),breakMinutes:0});}
        changes.push({shiftId:shift.id,employeeId:employee.id,employeeName,date,weekStart:date,entryType:"extra",startTime:shift.start_time.slice(0,5),endTime:shift.end_time.slice(0,5),breakMinutes:shift.break_minutes,segments});remaining-=normal;converted+=normal;
      }
      summaries.push({employeeId:employee.id,employeeName,date,totalHours:total/60,beforeWork:beforeWork/60,beforeExtra:beforeExtra/60,afterWork:(beforeWork+converted)/60,afterExtra:(beforeExtra-converted)/60,convertedHours:converted/60});
    }
  }
  return{ok:true,proposal:{from,to,employeeIds:parsedIds.data,changes,summaries,warnings}};
}

export async function applyCallAdjustment(proposal:CallAdjustmentProposal):Promise<CallAdjustmentResult>{
  if(!proposal?.changes?.length)return{ok:false,error:"La proposta non contiene modifiche da applicare."};
  const {supabase}=await requireAdmin();const {data,error}=await supabase.rpc("apply_shift_rebalance",{p_changes:proposal.changes});
  if(error)return{ok:false,error:error.message||"Impossibile applicare la proposta. Esegui shift-rebalance-migration.sql."};
  revalidatePath("/admin/dipendenti");revalidatePath("/admin/dipendenti/report");
  return{ok:true,message:`Conversione applicata a ${Number(data)||proposal.changes.length} turni.`};
}
