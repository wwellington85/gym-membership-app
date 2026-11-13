import Link from "next/link";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" tabIndex={-1} className="club-auth-main">
      <div className="club-auth-frame">
        <Link href="/" className="club-auth-brand">
          <span className="club-wordmark">Travellers Club</span>
          <p>Your membership, always with you.</p>
        </Link>
        {children}
      </div>
    </main>
  );
}
