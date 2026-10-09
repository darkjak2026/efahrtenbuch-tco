import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Schriften fest im Projekt (v2.42.01): der Build braucht kein Internet mehr – vorher
// brach er öfter beim Laden von Google Fonts ab. Dateien: app/fonts/*.woff2, Zeichensatz
// "latin" (deckt Deutsch mit Umlauten, ß, € und „“ ab), variable Schriften (Gewichtsbereich).
// Lizenz: SIL Open Font License 1.1 (Space Grotesk, Inter, JetBrains Mono).
const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk-latin.woff2",
  variable: "--font-space-grotesk",
  weight: "500 700",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  variable: "--font-inter",
  weight: "400 600",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  variable: "--font-jetbrains-mono",
  weight: "400 600",
  display: "swap",
});

export const metadata: Metadata = {
  title: "eFahrtenbuch⚡TCO",
  description: "Total Cost of Ownership für B10 & T03",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
