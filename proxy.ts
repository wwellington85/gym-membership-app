import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

type Role = "admin" | "front_desk" | "security";

const STAFF_PREFIXES = [
  "/dashboard",
  "/members",
  "/applications",
  "/payments",
  "/checkins",
  "/settings",
  "/more",
];

function isStaffPath(pathname: string) {
  return STAFF_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function roleAllowsPath(role: Role, pathname: string) {
  if (role === "admin") return true;

  if (role === "security") {
    return (
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname === "/members" ||
      pathname.startsWith("/members/") ||
      pathname === "/checkins" ||
      pathname.startsWith("/checkins/")
    );
  }

  if (role === "front_desk") {
    return (
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname === "/members" ||
      pathname.startsWith("/members/") ||
      pathname === "/applications" ||
      pathname.startsWith("/applications/") ||
      pathname === "/payments" ||
      pathname.startsWith("/payments/") ||
      pathname === "/checkins" ||
      pathname.startsWith("/checkins/")
    );
  }

  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Only protect staff routes
  if (!isStaffPath(pathname)) {
    return NextResponse.next();
  }

  // Prepare response so Supabase can set/refresh cookies
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("returnTo", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  // Assumes: staff_profiles(user_id, role)
  const { data: staffProfile, error } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !staffProfile?.role) {
    const memberUrl = request.nextUrl.clone();
    memberUrl.pathname = "/member";
    return NextResponse.redirect(memberUrl);
  }

  const role = staffProfile.role as Role;

  if (!roleAllowsPath(role, pathname)) {
    const safeUrl = request.nextUrl.clone();
    safeUrl.pathname = "/dashboard";
    safeUrl.searchParams.set("err", "Not authorized");
    return NextResponse.redirect(safeUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/members/:path*",
    "/applications/:path*",
    "/payments/:path*",
    "/checkins/:path*",
    "/settings/:path*",
    "/more/:path*",
  ],
};
