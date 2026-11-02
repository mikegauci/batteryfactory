import { NextResponse, type NextRequest } from "next/server";
import { findRedirect } from "@/lib/redirects";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const rule = await findRedirect(request.nextUrl.pathname);
  if (rule) {
    const target = new URL(rule.destination, request.url);
    // Keep the query string unless the rule sets its own.
    if (!target.search) target.search = request.nextUrl.search;
    return NextResponse.redirect(target, rule.permanent ? 301 : 302);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|mp4|ico)$).*)",
  ],
};
