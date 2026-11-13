import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error = "" } = await searchParams;
  const differentBrowser = /code verifier|pkce|flow state/i.test(error);
  return (
    <div className="flex w-full items-center justify-center py-2">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle className="text-2xl">{differentBrowser ? "Let’s try another sign-in method" : "This sign-in link could not be used"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {differentBrowser
              ? "This link needs information from the browser or Home Screen app where you requested it. Request a new sign-in email there and enter its code in that same app instead of opening the link."
              : "The link may have expired or already been used. Request a new email and use its code or link. Use only your latest email."}
          </p>
          <div className="flex flex-col gap-3 text-sm">
            <Link href="/auth/magic-link" className="underline underline-offset-4">Get a new sign-in code</Link>
            <Link href="/auth/forgot-password" className="underline underline-offset-4">Reset my password</Link>
            <Link href="/auth/login" className="underline underline-offset-4">Sign in with a password</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
