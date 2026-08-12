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
  title: "Mori's Cabin",
  description: "Mori's Cabin is a cozy pet companion you can install on your Home Screen.",
  manifest: "/manifest.webmanifest",
  applicationName: "Mori's Cabin",
  icons: {
    icon: [
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.webp", sizes: "512x512", type: "image/webp" },
    ],
    apple: [{ url: "/apple-touch-icon-v2.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mori's Cabin",
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
