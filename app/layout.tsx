import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Fraunces: an old-style display serif with optical sizing, the voice of a printed atlas.
const serif = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT"],
  display: "swap",
});


const DESCRIPTION =
  "Atlas-grade maps of anywhere on Earth in under three minutes. Describe it, drop in any data (a spreadsheet, a report, a list of places) and download a print-ready map with real relief, rivers and place names.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "CartoMapper: maps worth sharing, in minutes",
  description: DESCRIPTION,
  openGraph: {
    title: "CartoMapper: maps worth sharing, in minutes",
    description: DESCRIPTION,
    type: "website",
    siteName: "CartoMapper",
  },
  twitter: {
    card: "summary_large_image",
    title: "CartoMapper",
    description: "Atlas-grade maps of anywhere on Earth, from your data, in minutes.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
