"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { DayPicker } from "@daypicker/react";
import { it } from "date-fns/locale";
import "@daypicker/react/style.css";

type PickerMode = "day" | "week" | "month" | "quarter" | "year";

const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const dateFrom = (value:string) => new Date(`${value}T12:00:00`);
const weekValue = (date:Date) => { const current=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate(),12));const day=current.getUTCDay()||7;current.setUTCDate(current.getUTCDate()+4-day);const start=new Date(Date.UTC(current.getUTCFullYear(),0,1));return `${current.getUTCFullYear()}-W${String(Math.ceil((((current.getTime()-start.getTime())/86400000)+1)/7)).padStart(2,"0")}`; };
const weekDate = (value:string) => { const [year,week]=value.split("-W").map(Number);const jan4=new Date(Date.UTC(year,0,4,12));jan4.setUTCDate(jan4.getUTCDate()-(jan4.getUTCDay()||7)+1+(week-1)*7);return new Date(jan4.getUTCFullYear(),jan4.getUTCMonth(),jan4.getUTCDate(),12); };

export function PeriodPicker({mode,value,onChange}:{mode:PickerMode;value:string;onChange:(value:string)=>void}){
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const selected=mode==="day"?dateFrom(value):mode==="week"?weekDate(value):mode==="month"?dateFrom(`${value}-01`):undefined;
  const [visibleMonth,setVisibleMonth]=useState(selected??new Date());
  useEffect(()=>{const close=(event:PointerEvent)=>{if(root.current&&!root.current.contains(event.target as Node))setOpen(false)};document.addEventListener("pointerdown",close);return()=>document.removeEventListener("pointerdown",close)},[]);
  const label=mode==="day"?selected?.toLocaleDateString("it-IT",{day:"numeric",month:"short",year:"numeric"}):mode==="week"?`Settimana ${value.split("-W")[1]} · ${value.slice(0,4)}`:mode==="month"?selected?.toLocaleDateString("it-IT",{month:"long",year:"numeric"}):mode==="quarter"?`${value.split("-Q")[1]}° trimestre ${value.slice(0,4)}`:value;
  const choose=(date:Date|undefined)=>{if(!date)return;if(mode==="day")onChange(isoDate(date));if(mode==="week")onChange(weekValue(date));if(mode==="month")onChange(isoDate(date).slice(0,7));setOpen(false)};
  const currentYear=new Date().getFullYear();
  const years=Array.from({length:21},(_,index)=>currentYear-5+index);
  return <div className="period-picker" ref={root}>
    <button type="button" className="period-picker-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><CalendarDays size={15}/><span>{label}</span><ChevronDown size={14}/></button>
    {open&&<div className="period-picker-popover" role="dialog" aria-label="Seleziona periodo">
      {(mode==="day"||mode==="week"||mode==="month")&&<DayPicker mode="single" locale={it} selected={selected} month={visibleMonth} onMonthChange={setVisibleMonth} onSelect={choose} captionLayout="dropdown" startMonth={new Date(currentYear-10,0)} endMonth={new Date(currentYear+15,11)} showOutsideDays fixedWeeks/>}
      {mode==="quarter"&&<div className="period-option-grid">{years.flatMap(year=>[1,2,3,4].map(quarter=><button type="button" className={value===`${year}-Q${quarter}`?"active":""} key={`${year}-${quarter}`} onClick={()=>{onChange(`${year}-Q${quarter}`);setOpen(false)}}>T{quarter} <small>{year}</small></button>))}</div>}
      {mode==="year"&&<div className="period-year-grid">{years.map(year=><button type="button" className={value===String(year)?"active":""} key={year} onClick={()=>{onChange(String(year));setOpen(false)}}>{year}</button>)}</div>}
    </div>}
  </div>;
}
