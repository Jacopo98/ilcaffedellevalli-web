import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { driveOAuthConfig } from "@/lib/google-drive";

export async function GET(request: Request) {
  try {
    const { profile } = await requireAdmin();
    const origin = new URL(request.url).origin;
    const config = driveOAuthConfig(origin);
    const state = randomBytes(32).toString("base64url");
    const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorization.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", access_type: "offline", prompt: "consent", include_granted_scopes: "true", scope: `${config.scope} openid email`, state, login_hint: profile.email }).toString();
    const response = NextResponse.redirect(authorization);
    response.cookies.set("drive_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/google-drive/callback", maxAge: 600 });
    return response;
  } catch (error) {
    return NextResponse.redirect(new URL(`/admin/archivio?error=${encodeURIComponent(error instanceof Error ? error.message : "Configurazione Google incompleta")}`, request.url));
  }
}
