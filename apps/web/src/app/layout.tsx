import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";

import "./globals.css";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"], weight: ["300", "400", "500"] });
const sans = Manrope({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Swasthya",
  description: "A calm space to eat well, move daily and recover deeply.",
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
