import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/components/AuthProvider";
import { SITE } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  keywords: ["roblox scripts", "scripts roblox", "script hub", "place id", "KDS Scripts"],
  openGraph: {
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    type: "website",
    siteName: SITE.name,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <div className="bg-aurora" aria-hidden />
        <div className="grid-lines" aria-hidden />
        <AuthProvider>
          <Header />
          <main className="mx-auto w-full max-w-[1240px] px-4 pb-24 pt-6 sm:px-6">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
