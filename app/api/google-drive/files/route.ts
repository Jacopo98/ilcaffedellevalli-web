import { requireAdmin } from "@/lib/auth";
import { assertInsideDriveFolder, assertInsideDriveRoot, driveRequest, driveRootFolderId, FOLDER_MIME } from "@/lib/google-drive";

const jsonError = (error: unknown, status = 400) => Response.json({ error: error instanceof Error ? error.message : "Operazione non riuscita" }, { status });

export async function GET(request: Request) {
  try {
    const { profile } = await requireAdmin();
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim();
    const folderId = url.searchParams.get("folder") || driveRootFolderId();
    await assertInsideDriveRoot(profile.id, folderId);
    const safeSearch = search?.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
    const params = new URLSearchParams({ q: search ? `name contains '${safeSearch}' and trashed = false` : `'${folderId}' in parents and trashed = false`, fields: "files(id,name,mimeType,size,modifiedTime,iconLink,webViewLink,thumbnailLink,capabilities(canEdit,canDelete,canRename,canDownload))", orderBy: "folder,name_natural", pageSize: search ? "200" : "1000", spaces: "drive", supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
    const [filesResponse, folderResponse] = await Promise.all([
      driveRequest(profile.id, `/drive/v3/files?${params}`),
      driveRequest(profile.id, `/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,parents&supportsAllDrives=true`),
    ]);
    const listing = await filesResponse.json() as { files?: Array<{ id: string }> };
    const files = search ? (await Promise.all((listing.files ?? []).map(async (file) => {
      try { await assertInsideDriveFolder(profile.id, file.id, folderId); return file; } catch { return null; }
    }))).filter(Boolean) : listing.files ?? [];
    return Response.json({ files, folder: await folderResponse.json(), rootId: driveRootFolderId(), search: search || null });
  } catch (error) { return jsonError(error, 403); }
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireAdmin();
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const parentId = String(form.get("parentId") || driveRootFolderId());
      if (!(file instanceof File) || !file.size) throw new Error("Seleziona un file");
      if (file.size > 25_000_000) throw new Error("Il file supera il limite di 25 MB dell'upload web");
      await assertInsideDriveRoot(profile.id, parentId);
      const boundary = `archive-${crypto.randomUUID()}`;
      const metadata = JSON.stringify({ name: file.name, parents: [parentId] });
      const before = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`);
      const after = Buffer.from(`\r\n--${boundary}--`);
      const body = Buffer.concat([before, Buffer.from(await file.arrayBuffer()), after]);
      const response = await driveRequest(profile.id, "/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,modifiedTime", { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body });
      return Response.json(await response.json());
    }
    const values = await request.json() as { action?: string; parentId?: string; name?: string };
    if (values.action !== "folder" || !values.name?.trim()) throw new Error("Dati cartella non validi");
    const parentId = values.parentId || driveRootFolderId();
    await assertInsideDriveRoot(profile.id, parentId);
    const response = await driveRequest(profile.id, "/drive/v3/files?supportsAllDrives=true&fields=id,name,mimeType,modifiedTime", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: values.name.trim(), mimeType: FOLDER_MIME, parents: [parentId] }) });
    return Response.json(await response.json());
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request) {
  try {
    const { profile } = await requireAdmin();
    const values = await request.json() as { id?: string; name?: string };
    if (!values.id || !values.name?.trim()) throw new Error("Nome non valido");
    await assertInsideDriveRoot(profile.id, values.id, false);
    const response = await driveRequest(profile.id, `/drive/v3/files/${encodeURIComponent(values.id)}?supportsAllDrives=true&fields=id,name`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: values.name.trim() }) });
    return Response.json(await response.json());
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request) {
  try {
    const { profile } = await requireAdmin();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new Error("Elemento non valido");
    await assertInsideDriveRoot(profile.id, id, false);
    await driveRequest(profile.id, `/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) });
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
