"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Cloud, File, FileImage, FileSpreadsheet, FileText, Folder, FolderPlus, MoreHorizontal, Pencil, RefreshCw, Search, Trash2, Upload, X } from "lucide-react";

type DriveFile = { id:string; name:string; mimeType:string; size?:string; modifiedTime?:string; iconLink?:string; webViewLink?:string; thumbnailLink?:string; capabilities?:{canEdit?:boolean;canDelete?:boolean;canRename?:boolean;canDownload?:boolean} };
type FolderEntry = { id:string; name:string };
const FOLDER = "application/vnd.google-apps.folder";
const formatSize = (value?:string) => { const bytes=Number(value||0);if(!bytes)return "—";if(bytes<1024)return `${bytes} B`;if(bytes<1048576)return `${(bytes/1024).toFixed(1)} KB`;return `${(bytes/1048576).toFixed(bytes<10485760?1:0)} MB`; };
const icon = (file:DriveFile) => file.mimeType===FOLDER?<Folder/>:file.mimeType.includes("spreadsheet")?<FileSpreadsheet/>:file.mimeType.startsWith("image/")?<FileImage/>:file.mimeType.includes("document")||file.mimeType.includes("pdf")?<FileText/>:<File/>;

export function DriveArchive({googleEmail,initialFolderId}:{googleEmail:string;initialFolderId?:string}){
  const [files,setFiles]=useState<DriveFile[]>([]),[rootId,setRootId]=useState(""),[path,setPath]=useState<FolderEntry[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[menu,setMenu]=useState<string|null>(null),[folderDialog,setFolderDialog]=useState(false),[folderName,setFolderName]=useState(""),[searchQuery,setSearchQuery]=useState(""),[searchActive,setSearchActive]=useState(false);
  const fileInput=useRef<HTMLInputElement>(null);
  const current=path.at(-1)?.id||rootId;
  async function load(folderId?:string,reset=false){setLoading(true);setError("");try{const response=await fetch(`/api/google-drive/files${folderId?`?folder=${encodeURIComponent(folderId)}`:""}`,{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Impossibile caricare l’archivio");setFiles(result.files||[]);setRootId(result.rootId);if(reset||!path.length)setPath([{id:result.folder.id,name:result.folder.name}]);}catch(value){setError(value instanceof Error?value.message:"Errore Google Drive");}finally{setLoading(false)}}
  useEffect(()=>{
    let active=true;
    async function loadInitialFolder(){
      try{
        const response=await fetch(`/api/google-drive/files${initialFolderId?`?folder=${encodeURIComponent(initialFolderId)}`:""}`,{cache:"no-store"});
        const result=await response.json();
        if(!response.ok)throw new Error(result.error||"Impossibile caricare l’archivio");
        if(!active)return;
        setFiles(result.files||[]);
        setRootId(result.rootId);
        setPath([{id:result.folder.id,name:result.folder.name}]);
      }catch(value){
        if(active)setError(value instanceof Error?value.message:"Errore Google Drive");
      }finally{
        if(active)setLoading(false);
      }
    }
    void loadInitialFolder();
    return()=>{active=false};
  },[initialFolderId]);
  async function openFolder(file:DriveFile){setSearchActive(false);setSearchQuery("");setPath((value)=>searchActive?[value[0],{id:file.id,name:file.name}]:[...value,{id:file.id,name:file.name}]);await load(file.id)}
  async function goTo(index:number){const target=path[index];setSearchActive(false);setSearchQuery("");setPath((value)=>value.slice(0,index+1));await load(target.id)}
  async function searchFiles(event:React.FormEvent){event.preventDefault();const query=searchQuery.trim();if(!query){setSearchActive(false);await load(current);return}setLoading(true);setError("");try{const searchRoot=initialFolderId||rootId;const response=await fetch(`/api/google-drive/files?search=${encodeURIComponent(query)}&folder=${encodeURIComponent(searchRoot)}`,{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Ricerca non riuscita");setFiles(result.files||[]);setSearchActive(true)}catch(value){setError(value instanceof Error?value.message:"Ricerca non riuscita")}finally{setLoading(false)}}
  async function clearSearch(){setSearchQuery("");setSearchActive(false);await load(current)}
  async function createFolder(){if(!folderName.trim())return;await mutate("POST",{action:"folder",parentId:current,name:folderName});setFolderName("");setFolderDialog(false)}
  async function mutate(method:string,body:unknown){setLoading(true);setError("");try{const response=await fetch("/api/google-drive/files",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.error||"Operazione non riuscita");await load(current);}catch(value){setError(value instanceof Error?value.message:"Operazione non riuscita");setLoading(false)}}
  async function upload(selected:FileList|null){if(!selected?.length)return;setLoading(true);setError("");try{for(const file of Array.from(selected)){const data=new FormData();data.set("file",file);data.set("parentId",current);const response=await fetch("/api/google-drive/files",{method:"POST",body:data});const result=await response.json();if(!response.ok)throw new Error(result.error||`Upload non riuscito: ${file.name}`)}await load(current);}catch(value){setError(value instanceof Error?value.message:"Upload non riuscito");setLoading(false)}finally{if(fileInput.current)fileInput.current.value=""}}
  async function rename(file:DriveFile){const name=prompt("Nuovo nome",file.name);if(name&&name!==file.name)await mutate("PATCH",{id:file.id,name})}
  async function remove(file:DriveFile){if(!confirm(`Spostare “${file.name}” nel cestino di Google Drive?`))return;setLoading(true);try{const response=await fetch(`/api/google-drive/files?id=${encodeURIComponent(file.id)}`,{method:"DELETE"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Eliminazione non riuscita");await load(current);}catch(value){setError(value instanceof Error?value.message:"Eliminazione non riuscita");setLoading(false)}}
  return <section className="drive-browser">
    <header className="drive-toolbar"><div className="drive-breadcrumbs"><Cloud size={17}/>{path.map((entry,index)=><span key={entry.id}>{index>0&&<ChevronRight size={14}/>}<button onClick={()=>goTo(index)}>{entry.name}</button></span>)}</div><div><button className="admin-action admin-action-secondary" onClick={()=>load(current)}><RefreshCw size={15}/><span>Aggiorna</span></button><button className="admin-action admin-action-secondary" onClick={()=>setFolderDialog(true)}><FolderPlus size={16}/><span>Nuova cartella</span></button><button className="admin-action admin-action-primary" onClick={()=>fileInput.current?.click()}><Upload size={16}/><span>Carica file</span></button><input ref={fileInput} type="file" multiple hidden onChange={(event)=>upload(event.target.files)}/></div></header>
    <form className="drive-search" onSubmit={searchFiles}><Search size={17}/><input type="search" value={searchQuery} onChange={(event)=>setSearchQuery(event.target.value)} placeholder="Cerca file e cartelle in tutto l’archivio" aria-label="Cerca nell’archivio"/>{searchActive&&<button type="button" className="drive-search-clear" onClick={clearSearch}><X size={15}/><span>Azzera</span></button>}<button type="submit" className="drive-search-submit"><Search size={15}/><span>Cerca</span></button></form>
    <div className="drive-account-note">Connesso come <strong>{googleEmail}</strong>. Apertura e modifica dei documenti avvengono negli editor Google.</div>
    {error&&<div className="staff-alert"><span>{error}</span><button onClick={()=>setError("")}><X size={15}/></button></div>}
    {searchActive&&<div className="drive-search-result"><Search size={14}/><span>Risultati in tutto l’archivio per <strong>“{searchQuery.trim()}”</strong></span></div>}
    <div className="drive-file-list"><div className="drive-file-head"><span>Nome</span><span>Ultima modifica</span><span>Dimensione</span><span/></div>{files.map(file=><article key={file.id} onDoubleClick={()=>file.mimeType===FOLDER?openFolder(file):file.webViewLink&&window.open(file.webViewLink,"_blank","noopener,noreferrer")}><button className="drive-file-name" onClick={()=>file.mimeType===FOLDER?openFolder(file):file.webViewLink&&window.open(file.webViewLink,"_blank","noopener,noreferrer")}><i className={file.mimeType===FOLDER?"folder":""}>{icon(file)}</i><span><strong>{file.name}</strong><small>{file.mimeType===FOLDER?"Cartella":"Documento"}</small></span></button><span>{file.modifiedTime?new Date(file.modifiedTime).toLocaleString("it-IT",{dateStyle:"short",timeStyle:"short"}):"—"}</span><span>{file.mimeType===FOLDER?"—":formatSize(file.size)}</span><div className="drive-row-menu"><button aria-label={`Azioni per ${file.name}`} onClick={()=>setMenu(menu===file.id?null:file.id)}><MoreHorizontal/></button>{menu===file.id&&<div>{file.capabilities?.canRename!==false&&<button onClick={()=>rename(file)}><Pencil size={14}/> Rinomina</button>}{file.capabilities?.canDelete!==false&&<button className="danger" onClick={()=>remove(file)}><Trash2 size={14}/> Sposta nel cestino</button>}</div>}</div></article>)}{!loading&&!files.length&&<p className="drive-empty"><Folder size={28}/><strong>{searchActive?"Nessun risultato":"Questa cartella è vuota"}</strong><span>{searchActive?"Prova con un nome diverso.":"Carica un file o crea una nuova cartella."}</span></p>}</div>
    {loading&&<div className="drive-loading"><Cloud/><span>Sincronizzazione con Google Drive…</span></div>}
    {folderDialog&&<div className="admin-modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setFolderDialog(false)}}><section className="admin-modal"><button className="modal-close" onClick={()=>setFolderDialog(false)}><X/></button><p className="admin-kicker">Archivio generale</p><h2>Nuova cartella</h2><label className="admin-field"><span>Nome cartella</span><input autoFocus value={folderName} onChange={(event)=>setFolderName(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter")void createFolder()}}/></label><div className="modal-actions"><button className="admin-action admin-action-secondary" onClick={()=>setFolderDialog(false)}>Annulla</button><button className="admin-action admin-action-primary" onClick={createFolder}>Crea cartella</button></div></section></div>}
  </section>;
}
