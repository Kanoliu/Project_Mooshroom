import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const vartigo = localFont({
  src: "../../art-resources/Fonts/SenYeNaiChuanTi-2.ttf",
  variable: "--font-calendar",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Project Mooshroom",
  description: "A Next.js PWA starter for Project Mooshroom.",
  manifest: "/manifest.webmanifest",
  applicationName: "Project Mooshroom",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mooshroom",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4efe2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={vartigo.variable}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
