export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-10 pb-10">
      {children}
    </div>
  );
}
