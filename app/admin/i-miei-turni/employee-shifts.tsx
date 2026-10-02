"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useMemo, useState, useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, Sparkles, X } from "lucide-react";
import { requestExtraHours, requestShiftChange } from "./actions";

type Shift = { id:number;entry_type:string;shift_date:string;start_time:string;end_time:string;notes:string|null;approval_status:"pending"|"approved"|"rejected" };
type Request = { id:number;work_shift_id:number|null;request_type:"add_extra"|"change_shift";proposed_date:string;proposed_start_time:string;proposed_end_time:string;status:string };
type CalendarEntry = { id:string;entryType:string;date:string;start:string;end:string;request:boolean;shift:Shift|null;changePending:boolean };
type CardStyle = CSSProperties & { "--mobile-left":string;"--mobile-width":string;"--mobile-row":number;"--screen-top":string;"--screen-height":string;"--screen-left":string;"--screen-width":string };

const DAYS=["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"];
const LABELS:Record<string,string>={work:"",extra:"EXTRA",rol:"ROL",holiday:"Ferie",sick:"Malattia",request:"DA APPROVARE"};
const COLORS:Record<string,string>={extra:"#E8650A",rol:"#3978C5",holiday:"#248A73",sick:"#D94F70",request:"#7C3AED"};
const START_HOUR=4,END_HOUR=16,HOUR_HEIGHT=54;

function addDays(value:string,days:number){const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)}
function monthsAgo(value:string,months:number){const date=new Date(`${value}T12:00:00Z`),day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()-months);date.setUTCDate(Math.min(day,new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()));return date.toISOString().slice(0,10)}
function dateLabel(value:string){return new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`))}
function minutes(value:string){const [hour,minute]=value.slice(0,5).split(":").map(Number);return hour*60+minute}
function durationMinutes(start:string,end:string){const startMinutes=minutes(start),endMinutes=minutes(end);return endMinutes>=startMinutes?endMinutes-startMinutes:24*60-startMinutes+endMinutes}
function hoursLabel(totalMinutes:number){const hours=Math.floor(totalMinutes/60),remainingMinutes=totalMinutes%60;return remainingMinutes?`${hours} h ${String(remainingMinutes).padStart(2,"0")} min`:`${hours} h`}
function arrange(entries:CalendarEntry[]){const result:{entry:CalendarEntry;lane:number;laneCount:number}[]=[];let laneEnds:number[]=[],group:typeof result=[],groupEnd=-1;const finish=()=>{const count=Math.max(1,laneEnds.length);group.forEach(item=>item.laneCount=count)};[...entries].sort((a,b)=>minutes(a.start)-minutes(b.start)).forEach(entry=>{const start=minutes(entry.start);if(start>=groupEnd){finish();laneEnds=[];group=[]}let lane=laneEnds.findIndex(end=>end<=start);if(lane===-1){lane=laneEnds.length;laneEnds.push(minutes(entry.end))}else laneEnds[lane]=minutes(entry.end);const item={entry,lane,laneCount:1};result.push(item);group.push(item);groupEnd=Math.max(groupEnd,minutes(entry.end))});finish();return result}

export function EmployeeShifts({name,color,weekStart,shifts,requests}:{name:string;color:string;weekStart:string;shifts:Shift[];requests:Request[]}){
  const router=useRouter();
  const [extraOpen,setExtraOpen]=useState(false),[editing,setEditing]=useState<Shift|null>(null),[error,setError]=useState(""),[pending,startTransition]=useTransition();
  const today=new Date().toISOString().slice(0,10);
  const changeCutoff=monthsAgo(today,2);
  const days=useMemo(()=>DAYS.map((dayName,index)=>({name:dayName,date:addDays(weekStart,index)})),[weekStart]);
  const entries=useMemo<CalendarEntry[]>(()=>[
    ...shifts.map(shift=>({id:`shift-${shift.id}`,entryType:shift.entry_type,date:shift.shift_date,start:shift.start_time,end:shift.end_time,request:false,shift,changePending:requests.some(request=>request.work_shift_id===shift.id)})),
    ...requests.map(request=>({id:`request-${request.id}`,entryType:"request",date:request.proposed_date,start:request.proposed_start_time,end:request.proposed_end_time,request:true,shift:null,changePending:false})),
  ],[shifts,requests]);
  const hoursSummary=useMemo(()=>{
    const baseMinutes=shifts.filter(shift=>shift.entry_type==="work").reduce((total,shift)=>total+durationMinutes(shift.start_time,shift.end_time),0);
    const extraMinutes=shifts.filter(shift=>shift.entry_type==="extra").reduce((total,shift)=>total+durationMinutes(shift.start_time,shift.end_time),0);
    const pendingExtraMinutes=requests.filter(request=>request.request_type==="add_extra").reduce((total,request)=>total+durationMinutes(request.proposed_start_time,request.proposed_end_time),0);
    return {baseMinutes,extraMinutes,pendingExtraMinutes,totalMinutes:baseMinutes+extraMinutes};
  },[shifts,requests]);
  function run(action:(data:FormData)=>Promise<{ok:boolean;error?:string}>,data:FormData,close:()=>void){setError("");startTransition(async()=>{const result=await action(data);if(!result.ok){setError(result.error??"Operazione non riuscita.");return}close();router.refresh()})}

  return <main className="admin-container employee-portal">
    <header className="employee-portal-heading"><div><p className="admin-kicker">Area personale</p><h1>I miei turni</h1><p>Ciao {name}. Consulta la pianificazione e comunica aggiunte o variazioni.</p></div><button className="admin-action admin-action-primary admin-action-create" onClick={()=>setExtraOpen(true)}><Plus size={17}/> Aggiungi ore extra</button></header>
    {error&&<div className="staff-alert"><span>{error}</span><button onClick={()=>setError("")}><X size={16}/></button></div>}
    <section className="employee-week-toolbar"><Link aria-label="Settimana precedente" href={`/admin/i-miei-turni?week=${addDays(weekStart,-7)}`}><ChevronLeft/></Link><div><CalendarDays/><span><small>Settimana</small><strong>{dateLabel(weekStart)} – {dateLabel(addDays(weekStart,6))}</strong></span></div><Link aria-label="Settimana successiva" href={`/admin/i-miei-turni?week=${addDays(weekStart,7)}`}><ChevronRight/></Link></section>
    <section className="employee-calendar-note"><span><i style={{background:color}}/>Turni approvati</span><span><i className="request"/>Proposte in attesa</span><small>Seleziona un turno futuro per richiederne la modifica.</small></section>
    <div className="schedule-layout employee-personal-calendar">
      <aside className="schedule-hours" aria-hidden="true">{Array.from({length:END_HOUR-START_HOUR+1},(_,index)=><span style={{top:index*HOUR_HEIGHT}} key={index}>{String(START_HOUR+index).padStart(2,"0")}:00</span>)}</aside>
      <section className="week-calendar">{days.map(day=>{const arranged=arrange(entries.filter(entry=>entry.date===day.date)),mobileRows=Math.max(1,...arranged.map(item=>item.lane+1));return <article className="calendar-day" key={day.date}><header><div><strong>{day.name}</strong><span>{dateLabel(day.date)}</span></div></header><div className="day-timeline" style={{height:(END_HOUR-START_HOUR)*HOUR_HEIGHT,"--mobile-rows":mobileRows} as CSSProperties}>
        <div className="mobile-time-axis">{Array.from({length:END_HOUR-START_HOUR+1},(_,index)=>START_HOUR+index).map(hour=><span style={{left:`${((hour-START_HOUR)/(END_HOUR-START_HOUR))*100}%`}} key={hour}>{String(hour).padStart(2,"0")}</span>)}</div>
        {Array.from({length:END_HOUR-START_HOUR+1},(_,index)=><i className="mobile-hour-line" style={{left:`${(index/(END_HOUR-START_HOUR))*100}%`}} key={`mobile-${index}`}/>)}
        {Array.from({length:END_HOUR-START_HOUR},(_,index)=><i className="hour-line" style={{top:index*HOUR_HEIGHT}} key={index}/>)}
        {arranged.map(({entry,lane,laneCount})=>{const start=minutes(entry.start),end=minutes(entry.end),top=((start-START_HOUR*60)/60)*HOUR_HEIGHT,height=Math.max(34,((end-start)/60)*HOUR_HEIGHT),left=`calc(${lane/laneCount*100}% + .25rem)`,width=`calc(${100/laneCount}% - .5rem)`,entryColor=entry.request?COLORS.request:(COLORS[entry.entryType]||color);const style:CardStyle={top,height,left,width,borderColor:entryColor,background:`${entryColor}18`,"--mobile-left":`${((start-START_HOUR*60)/((END_HOUR-START_HOUR)*60))*100}%`,"--mobile-width":`${((end-start)/((END_HOUR-START_HOUR)*60))*100}%`,"--mobile-row":lane,"--screen-top":`${top}px`,"--screen-height":`${height}px`,"--screen-left":left,"--screen-width":width};const editable=Boolean(entry.shift&&entry.date>=changeCutoff&&!entry.changePending);return <button type="button" key={entry.id} className={`shift-card shift-type-${entry.entryType}${laneCount>1?" shift-card-compact":""}${entry.request||entry.changePending?" employee-calendar-request":""}`} style={style} disabled={!editable} onClick={()=>entry.shift&&setEditing(entry.shift)} title={`${entry.start.slice(0,5)}–${entry.end.slice(0,5)}`}>{(entry.request||entry.entryType!=="work")&&<em>{entry.request?"DA APPROVARE":LABELS[entry.entryType]}</em>}<strong>{name}</strong><span>{entry.start.slice(0,5)}–{entry.end.slice(0,5)}</span>{entry.changePending&&!entry.request&&<small>Modifica richiesta</small>}</button>})}
      </div></article>})}</section>
    </div>
    <section className="employee-hours-summary" aria-label="Riepilogo ore della settimana">
      <div className="employee-hours-summary-title"><span><Clock3/></span><div><p className="admin-kicker">Riepilogo settimanale</p><h2>Le tue ore</h2><small>{dateLabel(weekStart)} – {dateLabel(addDays(weekStart,6))}</small></div></div>
      <div className="employee-hours-total"><small>Totale pianificato</small><strong>{hoursLabel(hoursSummary.totalMinutes)}</strong></div>
      <div className="employee-hours-breakdown"><span><small>Turni ordinari</small><strong>{hoursLabel(hoursSummary.baseMinutes)}</strong></span><span><small>Ore extra approvate</small><strong>{hoursLabel(hoursSummary.extraMinutes)}</strong></span>{hoursSummary.pendingExtraMinutes>0&&<span className="is-pending"><Sparkles/><small>Extra in approvazione</small><strong>+ {hoursLabel(hoursSummary.pendingExtraMinutes)}</strong></span>}</div>
    </section>
    {extraOpen&&<RequestModal title="Aggiungi ore extra" pending={pending} minDate={today} onClose={()=>setExtraOpen(false)} onSubmit={data=>run(requestExtraHours,data,()=>setExtraOpen(false))}/>} 
    {editing&&<RequestModal title="Richiedi modifica turno" pending={pending} shift={editing} minDate={changeCutoff} onClose={()=>setEditing(null)} onSubmit={data=>{data.set("shift_id",String(editing.id));run(requestShiftChange,data,()=>setEditing(null))}}/>}
  </main>
}

function RequestModal({title,pending,shift,minDate,onClose,onSubmit}:{title:string;pending:boolean;shift?:Shift;minDate:string;onClose:()=>void;onSubmit:(data:FormData)=>void}){return <div className="admin-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!pending)onClose()}}><section className="admin-modal"><button className="modal-close" onClick={onClose}><X/></button><p className="admin-kicker">Richiesta dipendente</p><h2>{title}</h2><p className="employee-extra-intro">La variazione sarà applicata solo dopo l’approvazione dell’amministratore.</p><form className="admin-edit-grid" onSubmit={event=>{event.preventDefault();onSubmit(new FormData(event.currentTarget))}}><label className="admin-field admin-field-wide"><span>Giorno</span><input name="shift_date" type="date" min={minDate} defaultValue={shift?.shift_date} required/></label><label className="admin-field"><span>Inizio</span><input name="start_time" type="time" step="900" defaultValue={shift?.start_time.slice(0,5)} required/></label><label className="admin-field"><span>Fine</span><input name="end_time" type="time" step="900" defaultValue={shift?.end_time.slice(0,5)} required/></label><label className="admin-field admin-field-wide"><span>Motivo / note</span><textarea name="notes" rows={3}/></label><div className="modal-actions admin-field-wide"><button type="button" className="admin-action admin-action-secondary" onClick={onClose}>Annulla</button><button className="admin-action admin-action-primary" disabled={pending}>{pending?"Invio…":"Invia richiesta"}</button></div></form></section></div>}
