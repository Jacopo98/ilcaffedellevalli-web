import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { requireAdmin } from "@/lib/auth";
import { driveRequest, FOLDER_MIME } from "@/lib/google-drive";

export const maxDuration = 60;

type Employee = { id:number;first_name:string;last_name:string;tax_code:string|null;intermittent_communication_code:string|null };
type Shift = { employee_id:number;shift_date:string;start_time:string;end_time:string;break_minutes:number;actual_start_time:string|null;actual_end_time:string|null };
type Row = { taxCode:string;communicationCode:string;start:string;end:string };

const FIELD = "moduloIntermittenti[0].Campi[0]";
const INTERMITTENT_ARCHIVE_FOLDER_ID = "1KRFZtw-v6rJjDtMY4Aj5d6Nsh8AUIUzV";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const xmlEscape = (value:string) => value.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[char]!));
const minutes = (value:string) => { const [hour,minute]=value.slice(0,5).split(":").map(Number); return hour*60+minute; };
const nextDay = (value:string) => { const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+1);return date.toISOString().slice(0,10); };
const italianDate = (value:string) => value.split("-").reverse().join("/");
const folderDate = (value:string) => value.split("-").reverse().join("_");

function groupConsecutive(days:string[]) {
  const sorted=[...new Set(days)].sort();
  const groups:Array<{start:string;end:string}>=[];
  for(const day of sorted){const last=groups.at(-1);if(last&&nextDay(last.end)===day)last.end=day;else groups.push({start:day,end:day});}
  return groups;
}

function xmlDocument(employerTaxCode:string,email:string,rows:Row[]) {
  const cells=Array.from({length:10},(_,index)=>{const row=rows[index];const number=index+1;return `<CFlavoratore${number}>${xmlEscape(row?.taxCode??"")}</CFlavoratore${number}><CCcodcomunicazione${number}>${xmlEscape(row?.communicationCode??"")}</CCcodcomunicazione${number}><DTdatainizio${number}>${row?.start??""}</DTdatainizio${number}><DTdatafine${number}>${row&&row.end!==row.start?row.end:""}</DTdatafine${number}>`;}).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<xfa:datasets xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/"><xfa:data><moduloIntermittenti><Campi><CFdatorelavoro>${xmlEscape(employerTaxCode)}</CFdatorelavoro><BCbarcodeModello01>ML-15-01</BCbarcodeModello01><BCbarcodeModello01>ML-15-01</BCbarcodeModello01><EMmail>${xmlEscape(email)}</EMmail><ANannullamento>0</ANannullamento>${cells}</Campi></moduloIntermittenti></xfa:data></xfa:datasets>`;
}

async function filledPage(template:Uint8Array,rows:Row[]) {
  const document=await PDFDocument.load(template,{ignoreEncryption:true,updateMetadata:false});
  const form=document.getForm();
  for(let index=1;index<=10;index++){
    const row=rows[index-1];const prefix=`${FIELD}.Table1[0].Row${index}[0]`;
    form.getTextField(`${prefix}.CFlavoratore${index}[0]`).setText(row?.taxCode??"");
    form.getTextField(`${prefix}.CCcodcomunicazione${index}[0]`).setText(row?.communicationCode??"");
    form.getTextField(`${prefix}.DTdatainizio${index}[0]`).setText(row?italianDate(row.start):"");
    form.getTextField(`${prefix}.DTdatafine${index}[0]`).setText(row&&row.end!==row.start?italianDate(row.end):"");
  }
  form.flatten();
  return document;
}

async function findOrCreateFolder(userId:string,parentId:string,name:string) {
  const safe=name.replace(/'/g,"\\'");
  const query=encodeURIComponent(`'${parentId}' in parents and name = '${safe}' and mimeType = '${FOLDER_MIME}' and trashed = false`);
  const found=await driveRequest(userId,`/drive/v3/files?q=${query}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  const listing=await found.json() as {files?:Array<{id:string}>};if(listing.files?.[0])return listing.files[0].id;
  const created=await driveRequest(userId,"/drive/v3/files?supportsAllDrives=true&fields=id",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,mimeType:FOLDER_MIME,parents:[parentId]})});
  return ((await created.json()) as {id:string}).id;
}

async function upload(userId:string,parentId:string,name:string,mimeType:string,bytes:Uint8Array|string) {
  const boundary=`intermittent_${crypto.randomUUID()}`;const content=typeof bytes==="string"?new TextEncoder().encode(bytes):bytes;
  const before=new TextEncoder().encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name,parents:[parentId]})}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`);
  const after=new TextEncoder().encode(`\r\n--${boundary}--`);const body=new Uint8Array(before.length+content.length+after.length);body.set(before);body.set(content,before.length);body.set(after,before.length+content.length);
  await driveRequest(userId,"/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id",{method:"POST",headers:{"Content-Type":`multipart/related; boundary=${boundary}`},body});
}

export async function POST(request:Request) {
  try{
    const {supabase,profile}=await requireAdmin();const input=await request.json() as {from?:string;to?:string;employeeIds?:unknown};const from=input.from??"",to=input.to??"";
    if(!datePattern.test(from)||!datePattern.test(to)||to<from)return Response.json({error:"Seleziona un intervallo di date valido."},{status:400});
    const employeeIds=Array.isArray(input.employeeIds)?[...new Set(input.employeeIds.filter((value):value is number=>Number.isInteger(value)&&Number(value)>0).map(Number))]:[];
    if(!employeeIds.length||employeeIds.length>100)return Response.json({error:"Seleziona almeno un dipendente a chiamata."},{status:400});
    const {data:employees,error:employeeError}=await supabase.from("employees").select("id,first_name,last_name,tax_code,intermittent_communication_code").in("id",employeeIds).eq("contract_type","on_call").eq("is_active",true).order("first_name");
    if(employeeError)return Response.json({error:"Esegui employee-intermittent-communication-migration.sql su Supabase."},{status:500});
    const staff=(employees??[]) as Employee[];if(!staff.length)return Response.json({error:"I dipendenti selezionati non risultano attivi con contratto a chiamata."},{status:422});
    const {data:shifts,error:shiftError}=await supabase.from("work_shifts").select("employee_id,shift_date,start_time,end_time,actual_start_time,actual_end_time,break_minutes").in("employee_id",staff.map(item=>item.id)).eq("approval_status","approved").gte("shift_date",from).lte("shift_date",to).order("shift_date");
    if(shiftError)return Response.json({error:"Impossibile leggere i turni del periodo."},{status:500});
    const rows:Row[]=[];const incomplete:string[]=[];
    for(const employee of staff){
      const daily=new Map<string,number>();for(const shift of (shifts??[]) as Shift[]){if(shift.employee_id!==employee.id)continue;const start=shift.actual_start_time||shift.start_time,end=shift.actual_end_time||shift.end_time;daily.set(shift.shift_date,(daily.get(shift.shift_date)??0)+Math.max(0,minutes(end)-minutes(start)-shift.break_minutes));}
      const days=[...daily].filter(([,total])=>total>=60).map(([day])=>day);if(!days.length)continue;
      if(!employee.tax_code||!employee.intermittent_communication_code){incomplete.push(`${employee.first_name} ${employee.last_name}`);continue;}
      for(const group of groupConsecutive(days))rows.push({taxCode:employee.tax_code,communicationCode:employee.intermittent_communication_code,start:group.start,end:group.end});
    }
    if(incomplete.length)return Response.json({error:`Completa codice fiscale e codice comunicazione per: ${incomplete.join(", ")}.`},{status:422});
    if(!rows.length)return Response.json({error:"Nessun dipendente a chiamata ha almeno un’ora pianificata nel periodo selezionato."},{status:422});
    const template=new Uint8Array(await readFile(path.join(process.cwd(),"public","templates","UNI_Intermittenti_1_precompilato.pdf")));const initial=await PDFDocument.load(template,{ignoreEncryption:true});const initialForm=initial.getForm();const employerTaxCode=initialForm.getTextField(`${FIELD}.CFdatorelavoro[0]`).getText()||"";const email=initialForm.getTextField(`${FIELD}.EMmail[0]`).getText()||"";
    const chunks=Array.from({length:Math.ceil(rows.length/10)},(_,index)=>rows.slice(index*10,index*10+10));const output=await PDFDocument.create();const xmlFiles:string[]=[];
    for(const chunk of chunks){const pageDocument=await filledPage(template,chunk);const [page]=await output.copyPages(pageDocument,[0]);output.addPage(page);xmlFiles.push(xmlDocument(employerTaxCode,email,chunk));}
    output.setTitle(`UNI Intermittenti ${from} - ${to}`);const pdf=await output.save();const stamp=`${from}_${to}`;
    const folder=await findOrCreateFolder(profile.id,INTERMITTENT_ARCHIVE_FOLDER_ID,`${folderDate(from)}-${folderDate(to)}-CHIAMATE`);
    await upload(profile.id,folder,`UNI_Intermittenti_${stamp}.pdf`,"application/pdf",pdf);
    for(const [index,xml] of xmlFiles.entries())await upload(profile.id,folder,`UNI_Intermittenti_${stamp}${xmlFiles.length>1?`_${index+1}`:""}.xml`,"application/xml",xml);
    return new Response(Buffer.from(pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="UNI_Intermittenti_${stamp}.pdf"`,"X-Generated-Rows":String(rows.length),"X-Generated-Xml":String(xmlFiles.length),"X-Drive-Folder-Url":`https://drive.google.com/drive/folders/${folder}`,"Cache-Control":"no-store"}});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Generazione non riuscita."},{status:500});}
}
