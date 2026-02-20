export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-xl h-svh overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 pt-4 pb-10 sm:px-4 sm:pt-6">
      <div className="oura-shell p-3 sm:p-4">{children}</div>
    </div>
  );
}
