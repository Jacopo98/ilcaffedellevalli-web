import type { Metadata, Viewport } from "next";
import { Inter, Mina } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const mina = Mina({
  variable: "--font-mina",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Il Caffè delle Valli | Paladina",
  description: "Caffetteria, colazioni e aperitivi a Paladina, nel cuore delle Valli bergamasche.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1c1c1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${inter.variable} ${mina.variable} scroll-smooth`}>
      <body>{children}</body>
    </html>
  );
}
