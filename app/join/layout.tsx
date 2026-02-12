export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md h-svh overflow-y-auto overscroll-y-contain px-4 pt-6 pb-10">
      <div className="oura-shell p-4">{children}</div>
    </div>
  );
}
