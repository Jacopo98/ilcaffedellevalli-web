import { requireAdmin } from "@/lib/auth";
import { assertInsideDriveRoot, driveRequest, driveRootFolderId, FOLDER_MIME } from "@/lib/google-drive";

const errorResponse = (error: unknown, status = 400) => Response.json({ error: error instanceof Error ? error.message : "Operazione non riuscita" }, { status });
const folderIdFrom = (value: string) => value.trim().match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1] ?? value.trim();

export async function POST(request: Request) {
  try {
    const { profile, supabase } = await requireAdmin();
    const values = await request.json() as { employeeId?: number; action?: "create" | "link"; folder?: string };
    if (!Number.isInteger(values.employeeId) || Number(values.employeeId) <= 0) throw new Error("Dipendente non valido");
    const { data: employee, error } = await supabase.from("employees").select("id,first_name,last_name,drive_folder_id").eq("id", values.employeeId).single();
    if (error || !employee) throw new Error("Dipendente non trovato");

    let folderId = "";
    if (values.action === "create") {
      if (employee.drive_folder_id) throw new Error("Il dipendente ha già una cartella documenti");
      const response = await driveRequest(profile.id, "/drive/v3/files?supportsAllDrives=true&fields=id,name,mimeType", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Documenti - ${employee.first_name} ${employee.last_name}`.trim(), mimeType: FOLDER_MIME, parents: [driveRootFolderId()] }),
      });
      const folder = await response.json() as { id: string };
      folderId = folder.id;
    } else if (values.action === "link" && values.folder) {
      folderId = folderIdFrom(values.folder);
      await assertInsideDriveRoot(profile.id, folderId);
      const response = await driveRequest(profile.id, `/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,mimeType&supportsAllDrives=true`);
      const folder = await response.json() as { mimeType?: string };
      if (folder.mimeType !== FOLDER_MIME) throw new Error("Il collegamento non identifica una cartella Google Drive");
    } else throw new Error("Scegli se creare o collegare una cartella");

    const { error: saveError } = await supabase.from("employees").update({ drive_folder_id: folderId }).eq("id", employee.id);
    if (saveError) throw new Error(saveError.code === "23505" ? "Questa cartella è già associata a un altro dipendente" : "Impossibile associare la cartella al dipendente");
    return Response.json({ ok: true, folderId });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const employeeId = Number(new URL(request.url).searchParams.get("employee"));
    if (!Number.isInteger(employeeId) || employeeId <= 0) throw new Error("Dipendente non valido");
    const { error } = await supabase.from("employees").update({ drive_folder_id: null }).eq("id", employeeId);
    if (error) throw new Error("Impossibile scollegare la cartella");
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
