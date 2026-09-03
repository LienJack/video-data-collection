import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { catalogs, createTranslator } from "@egocapture/core/i18n";
import { requestLocale } from "@egocapture/core/server/i18n";
import { I18nProvider } from "@egocapture/ui/lib/i18n";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const display = Geist({ variable: "--font-display", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  const { t } = createTranslator(locale);
  return { title: t("meta.adminTitle"), description: t("meta.adminDescription") };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await requestLocale();
  return (
    <html lang={locale} data-scroll-behavior="smooth" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body><I18nProvider locale={locale} catalog={catalogs[locale]}>{children}</I18nProvider></body>
    </html>
  );
}
