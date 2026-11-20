import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { driveRequest, FOLDER_MIME } from "@/lib/google-drive";

export const maxDuration = 60;

const ARCHIVE_FOLDER_ID="1KRFZtw-v6rJjDtMY4Aj5d6Nsh8AUIUzV";
const FROM="Il Caffè delle Valli <info@ilcaffedellevalli.it>";
const SUBJECT="Invio telematico Modulo Intermittenti - IL CAFFE' DELLE VALLI SRL";
const requestSchema=z.object({
  recipients:z.array(z.email()).min(1).max(20),
  folderId:z.string().min(10).max(200),
  files:z.array(z.object({id:z.string().min(10).max(200),name:z.string().min(1).max(240),mimeType:z.string().min(1).max(120)})).min(2).max(12),
});

export async function POST(request:Request){
  try{
    const {profile,supabase}=await requireAdmin();
    if(!process.env.RESEND_API_KEY)return Response.json({error:"Configurazione email incompleta: manca RESEND_API_KEY su Vercel."},{status:500});
    const parsed=requestSchema.safeParse(await request.json());if(!parsed.success)return Response.json({error:"Destinatari o documenti non validi."},{status:400});
    const recipients=[...new Set(parsed.data.recipients.map(value=>value.trim().toLowerCase()))];
    const folderResponse=await driveRequest(profile.id,`/drive/v3/files/${encodeURIComponent(parsed.data.folderId)}?fields=id,mimeType,parents&supportsAllDrives=true`);const folder=await folderResponse.json() as {mimeType:string;parents?:string[]};
    if(folder.mimeType!==FOLDER_MIME||!folder.parents?.includes(ARCHIVE_FOLDER_ID))return Response.json({error:"La cartella dei documenti non appartiene all’archivio delle chiamate."},{status:400});
    const attachments:Array<{filename:string;content:string}>=[];
    for(const requested of parsed.data.files){
      const metadataResponse=await driveRequest(profile.id,`/drive/v3/files/${encodeURIComponent(requested.id)}?fields=id,name,mimeType,size,parents&supportsAllDrives=true`);const metadata=await metadataResponse.json() as {name:string;mimeType:string;size?:string;parents?:string[]};
      if(!metadata.parents?.includes(parsed.data.folderId)||(!metadata.name.endsWith(".pdf")&&!metadata.name.endsWith(".xml")))return Response.json({error:"Uno degli allegati non è valido."},{status:400});
      if(Number(metadata.size??0)>10_000_000)return Response.json({error:`L’allegato ${metadata.name} supera 10 MB.`},{status:413});
      const contentResponse=await driveRequest(profile.id,`/drive/v3/files/${encodeURIComponent(requested.id)}?alt=media&supportsAllDrives=true`);attachments.push({filename:metadata.name,content:Buffer.from(await contentResponse.arrayBuffer()).toString("base64")});
    }
    const text="Buongiorno,\n\nInoltro in allegato i documenti per le chiamate dei dipendenti delle date indicate.\n\nCordiali saluti,\n\n\nJacopo Boffelli\nIl Caffè delle Valli";
    const html='<div style="font-family:Arial,sans-serif;color:#1c1c1a;line-height:1.65"><p>Buongiorno,</p><p>Inoltro in allegato i documenti per le chiamate dei dipendenti delle date indicate.</p><p style="margin-top:28px">Cordiali saluti,</p><p style="margin-top:28px"><strong>Jacopo Boffelli</strong><br/>Il Caffè delle Valli</p></div>';
    const emailResponse=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:FROM,to:recipients,subject:SUBJECT,text,html,attachments})});
    if(!emailResponse.ok){const detail=await emailResponse.json().catch(()=>null) as {message?:string}|null;return Response.json({error:detail?.message||`Invio email non riuscito (${emailResponse.status}).`},{status:502});}
    const {error:settingsError}=await supabase.from("intermittent_email_settings").upsert({id:1,recipients,updated_by:profile.id,updated_at:new Date().toISOString()},{onConflict:"id"});
    if(settingsError)return Response.json({error:"Email inviata, ma destinatari non salvati. Esegui intermittent-email-settings-migration.sql.",sent:true},{status:500});
    return Response.json({ok:true,recipients:recipients.length});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Invio non riuscito."},{status:500});}
}
