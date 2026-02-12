export default function MemberLayout({ children }: { children: React.ReactNode }) {
  // NOTE: MemberTabs is rendered in app/(member)/layout.tsx so it can be truly fixed to viewport bottom.
  return <div className="pb-tabbar">{children}</div>;
}
