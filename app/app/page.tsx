import { AppEntry } from "@/components/pwa/app-entry";

// Keep the installed-app entry static: branding can render before auth queries.
export default function InstalledAppPage() {
  return <AppEntry />;
}
