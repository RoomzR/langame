import "./globals.css";
import { Sofia_Sans_Extra_Condensed, Manrope, JetBrains_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BottomNav } from "@/components/bottom-nav";
import { RouteLine } from "@/components/route-line";

const display = Sofia_Sans_Extra_Condensed({
  subsets: ["cyrillic", "latin"],
  variable: "--font-display",
  weight: ["700", "800", "900"],
});

const body = Manrope({
  subsets: ["cyrillic", "latin"],
  variable: "--font-body",
  weight: ["400", "500", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["cyrillic", "latin"],
  variable: "--font-mono",
  weight: ["500"],
});

export const metadata = {
  title: "RUDEMIR — клубы Беларуси",
  description: "Бронь игровых мест в компьютерных клубах. Оплата в белорусских рублях.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru-BY" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <RouteLine />
        <SiteHeader />
        <main className="mx-auto max-w-wrap px-4 pb-28 pt-24 md:px-6 md:pb-12">{children}</main>
        <SiteFooter />
        <BottomNav />
      </body>
    </html>
  );
}
