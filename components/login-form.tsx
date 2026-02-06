"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const initialEmail = useMemo(() => {
    if (typeof window === "undefined") return "";
    const v = new URLSearchParams(window.location.search).get("email");
    return v ? String(v) : "";
  }, []);

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSent, setShowSent] = useState(false);
  const router = useRouter();

  // Avoid useSearchParams() here to prevent Suspense CSR bailout issues.
  const returnTo = useMemo(() => {
    if (typeof window === "undefined") return "";
    const v = new URLSearchParams(window.location.search).get("returnTo");
    return v ? String(v) : "";
  }, []);

  const errMsg = useMemo(() => {
    if (typeof window === "undefined") return "";
    const v = new URLSearchParams(window.location.search).get("err");
    return v ? String(v) : "";
  }, []);


  const sentMsg = useMemo(() => {
    if (typeof window === "undefined") return "";
    const sent = new URLSearchParams(window.location.search).get("sent");
    return sent === "1" ? "Password reset email sent. Please check your inbox." : "";
  }, []);

  useEffect(() => {
    if (!sentMsg) return;
    setShowSent(true);
    const t = window.setTimeout(() => setShowSent(false), 4000);
    return () => window.clearTimeout(t);
  }, [sentMsg]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const u = userRes?.user;
      const isStaff = !!u?.user_metadata?.is_staff;

      const safeStaffPrefixes = [
        "/dashboard",
        "/members",
        "/applications",
        "/payments",
        "/checkins",
        "/settings",
        "/more",
      ];

      const isSafeStaffReturnTo =
        !!returnTo &&
        safeStaffPrefixes.some((prefix) => returnTo === prefix || returnTo.startsWith(prefix + "/"));

      const isSafeMemberReturnTo = !!returnTo && (returnTo === "/member" || returnTo.startsWith("/member/"));

      if (isStaff) {
        router.replace(isSafeStaffReturnTo ? returnTo : "/dashboard");
      } else {
        router.replace(isSafeMemberReturnTo ? returnTo : "/member");
      }
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>Enter your email below to login to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {showSent && sentMsg && <p className="text-sm text-green-600">{sentMsg}</p>}
              {errMsg && <p className="text-sm text-red-500">{errMsg}</p>}
              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </div>

            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link href="/join" className="underline underline-offset-4">
                Join Travellers Club
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
