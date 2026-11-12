export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      id="main-content"
      className="mx-auto h-svh w-full max-w-md overflow-y-auto overscroll-y-contain px-4 pt-6 pb-10"
    >
      {children}
    </main>
  );
}
