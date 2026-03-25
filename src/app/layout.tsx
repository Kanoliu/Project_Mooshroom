import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

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
  themeColor: "#f4efe2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
