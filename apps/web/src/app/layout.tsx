import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import "./globals.css";

const display = localFont({ src: "./fonts/Fraunces.woff2", variable: "--font-display", weight: "300 500", display: "swap" });
const sans = localFont({ src: "./fonts/Manrope.woff2", variable: "--font-sans", weight: "400 700", display: "swap" });

export const metadata: Metadata = {
  title: "Swasthya",
  description: "A calm space to eat well, move daily and recover deeply.",
  icons: {
    icon: { url: "/brand/swasthya-lotus.svg", type: "image/svg+xml" },
    apple: { url: "/brand/apple-touch-icon.png", sizes: "180x180" },
  },
  appleWebApp: { capable: true, title: "Swasthya", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f4f1ea",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable}`}>{children}</body>
    </html>
  );
}
