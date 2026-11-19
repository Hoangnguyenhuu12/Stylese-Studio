import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/playfair-display/wght-italic.css";
import "./globals.css";
import "./aurora.css";
import { PreferencesProvider } from "./components/preferences";
import SiteHeader from "./components/site-header";
import PageTransition from "./components/page-transition";
import DotSpotlight from "./components/dot-spotlight";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stylese Studio — Personal AI Stylist",
  description:
    "Personal AI stylist for outfit matching, wardrobe curation, and size guidance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><PreferencesProvider><DotSpotlight /><SiteHeader /><PageTransition>{children}</PageTransition></PreferencesProvider></body>
    </html>
  );
}
