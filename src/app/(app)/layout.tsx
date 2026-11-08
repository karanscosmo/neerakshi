import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AppNav } from "@/components/navigation/AppNav";
import { SiteFooter } from "@/components/navigation/SiteFooter";
import { LanguageAttr } from "@/components/navigation/LanguageSwitcher";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LanguageAttr />
      <div className="flex min-h-screen flex-col">
        <AppNav />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </div>
    </NextIntlClientProvider>
  );
}
