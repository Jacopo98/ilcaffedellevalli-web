import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { driveOAuthConfig, saveDriveConnection } from "@/lib/google-drive";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/admin/archivio", request.url));
  try {
    const { profile } = await requireAdmin();
    const stateCookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("drive_oauth_state="))?.slice("drive_oauth_state=".length);
    if (!url.searchParams.get("state") || url.searchParams.get("state") !== stateCookie) throw new Error("Verifica OAuth non valida");
    const code = url.searchParams.get("code");
    if (!code) throw new Error(url.searchParams.get("error") || "Autorizzazione Google annullata");
    const config = driveOAuthConfig(url.origin);
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, grant_type: "authorization_code", redirect_uri: config.redirectUri }) });
    if (!tokenResponse.ok) throw new Error("Google non ha restituito token validi");
    const tokens = await tokenResponse.json() as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
    const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (!userResponse.ok) throw new Error("Impossibile leggere l'account Google collegato");
    const googleUser = await userResponse.json() as { email?: string };
    if (!googleUser.email) throw new Error("L'account Google non espone un indirizzo email");
    await saveDriveConnection(profile.id, { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresIn: tokens.expires_in, scope: tokens.scope, googleEmail: googleUser.email });
  } catch (error) {
    response.headers.set("location", new URL(`/admin/archivio?error=${encodeURIComponent(error instanceof Error ? error.message : "Connessione non riuscita")}`, request.url).toString());
  }
  response.cookies.delete("drive_oauth_state");
  return response;
}
