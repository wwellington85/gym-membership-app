import { MemberTabs } from "@/components/nav/member-tabs";

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-24">{children}</div>
      <MemberTabs />
    </>
  );
}
