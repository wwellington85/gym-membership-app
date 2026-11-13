import Link from "next/link";
export default function JoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" tabIndex={-1} className="club-auth-main">
      <div className="club-auth-frame">
        <Link href="/" className="club-auth-brand">
          <span className="club-wordmark">Travellers Club</span>
          <p>Travellers Beach Resort</p>
        </Link>
        <div className="oura-card p-5 sm:p-6">{children}</div>
      </div>
    </main>
  );
}
