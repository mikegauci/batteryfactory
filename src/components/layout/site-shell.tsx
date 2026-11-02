import { getSiteSettings } from "@/lib/site-settings";
import { siteNavigation } from "@/lib/navigation";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <>
      <Header navigation={siteNavigation(settings.navigation)} />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
