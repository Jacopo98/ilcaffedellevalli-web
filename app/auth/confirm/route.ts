import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/lib/supabase/auth-server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const redirectTo = request.nextUrl.clone();
  redirectTo.search = "";
  redirectTo.pathname = type === "invite" || type === "recovery"
    ? "/area-riservata/imposta-password"
    : "/area-riservata";

  if (tokenHash && type) {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(redirectTo);
  }

  redirectTo.pathname = "/area-riservata";
  redirectTo.searchParams.set("auth_error", "link_non_valido");
  return NextResponse.redirect(redirectTo);
}
