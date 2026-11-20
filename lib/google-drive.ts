import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const FOLDER_MIME = "application/vnd.google-apps.folder";

type DriveConnection = {
  user_id: string;
  google_email: string;
  encrypted_access_token: string;
  encrypted_refresh_token: string | null;
  token_expiry: string | null;
  granted_scope: string | null;
};

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Configurazione mancante: ${name}`);
  return value;
}

function encryptionKey() {
  return createHash("sha256").update(required("GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY")).digest();
}

export function encryptDriveSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptDriveSecret(value: string) {
  const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !encrypted) throw new Error("Token Google Drive non valido");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function driveRootFolderId() {
  const configured = required("GOOGLE_DRIVE_ROOT_FOLDER_ID").trim();
  const match = configured.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? configured;
}

export function driveOAuthConfig(origin?: string) {
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || (origin ? `${origin}/api/google-drive/callback` : "");
  return { clientId: required("GOOGLE_DRIVE_CLIENT_ID"), clientSecret: required("GOOGLE_DRIVE_CLIENT_SECRET"), redirectUri, scope: DRIVE_SCOPE };
}

export function isDriveConfigured() {
  return Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID && process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY);
}

export async function getDriveConnectionSummary(userId: string) {
  if (!isDriveConfigured()) return null;
  const { data } = await createServiceClient().from("google_drive_connections").select("google_email,token_expiry").eq("user_id", userId).maybeSingle();
  return data as { google_email: string; token_expiry: string | null } | null;
}

export async function saveDriveConnection(userId: string, values: { accessToken: string; refreshToken?: string | null; expiresIn?: number; scope?: string | null; googleEmail: string }) {
  const service = createServiceClient();
  const { data: current } = await service.from("google_drive_connections").select("encrypted_refresh_token").eq("user_id", userId).maybeSingle();
  const encryptedRefresh = values.refreshToken ? encryptDriveSecret(values.refreshToken) : current?.encrypted_refresh_token ?? null;
  const expiry = values.expiresIn ? new Date(Date.now() + values.expiresIn * 1000).toISOString() : null;
  const { error } = await service.from("google_drive_connections").upsert({ user_id: userId, google_email: values.googleEmail, encrypted_access_token: encryptDriveSecret(values.accessToken), encrypted_refresh_token: encryptedRefresh, token_expiry: expiry, granted_scope: values.scope ?? null }, { onConflict: "user_id" });
  if (error) throw new Error("Impossibile salvare la connessione Google Drive");
}

async function connection(userId: string) {
  const { data, error } = await createServiceClient().from("google_drive_connections").select("user_id,google_email,encrypted_access_token,encrypted_refresh_token,token_expiry,granted_scope").eq("user_id", userId).single();
  if (error || !data) throw new Error("Google Drive non collegato");
  return data as DriveConnection;
}

export async function getDriveAccessToken(userId: string) {
  const current = await connection(userId);
  if (!current.token_expiry || new Date(current.token_expiry).getTime() > Date.now() + 60_000) return decryptDriveSecret(current.encrypted_access_token);
  if (!current.encrypted_refresh_token) throw new Error("Ricollega Google Drive per rinnovare l'autorizzazione");
  const config = driveOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: decryptDriveSecret(current.encrypted_refresh_token), grant_type: "refresh_token" }) });
  if (!response.ok) throw new Error("Autorizzazione Google Drive scaduta: ricollega l'account");
  const tokens = await response.json() as { access_token: string; expires_in: number; scope?: string };
  await saveDriveConnection(userId, { accessToken: tokens.access_token, expiresIn: tokens.expires_in, scope: tokens.scope ?? current.granted_scope, googleEmail: current.google_email });
  return tokens.access_token;
}

export async function driveRequest(userId: string, path: string, init?: RequestInit) {
  const token = await getDriveAccessToken(userId);
  const response = await fetch(`https://www.googleapis.com${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...init?.headers } });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(response.status === 403 ? "L'account Google non ha i permessi richiesti sulla cartella" : `Google Drive: ${detail.slice(0, 300)}`);
  }
  return response;
}

export async function assertInsideDriveRoot(userId: string, fileId: string, allowRoot = true) {
  const root = driveRootFolderId();
  return assertInsideDriveFolder(userId, fileId, root, allowRoot);
}

export async function assertInsideDriveFolder(userId: string, fileId: string, folderId: string, allowFolder = true) {
  if (folderId !== driveRootFolderId()) await assertInsideDriveRoot(userId, folderId);
  if (fileId === folderId) {
    if (allowFolder) return;
    throw new Error("La cartella radice non può essere modificata");
  }
  let current = fileId;
  const visited = new Set<string>();
  for (let depth = 0; depth < 60; depth++) {
    if (visited.has(current)) break;
    visited.add(current);
    const response = await driveRequest(userId, `/drive/v3/files/${encodeURIComponent(current)}?fields=id,parents&supportsAllDrives=true`);
    const file = await response.json() as { parents?: string[] };
    const parent = file.parents?.[0];
    if (!parent) break;
    if (parent === folderId) return;
    current = parent;
  }
  throw new Error("Elemento esterno all'archivio autorizzato");
}

export { FOLDER_MIME };
