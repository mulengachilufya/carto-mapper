import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const serif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const DESCRIPTION =
  "Turn your data into a print-ready, professionally designed map (PDF) for $5. Real cartography by design — not AI clip-art.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "CartoMapper — publication-quality maps in 60 seconds",
  description: DESCRIPTION,
  openGraph: {
    title: "CartoMapper — publication-quality maps in 60 seconds",
    description: DESCRIPTION,
    type: "website",
    siteName: "CartoMapper",
  },
  twitter: {
    card: "summary_large_image",
    title: "CartoMapper",
    description: "Publication-quality maps from your data, for $5.",
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
