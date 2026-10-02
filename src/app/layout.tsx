import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Job Finder — Control Center",
  description:
    "Search real job portals with location-aware routing: type any city + country and get scoped results — no more wrong-country listings. Includes fit ranking, shortlists and CSV exports.",
  keywords: ["job finder", "job search", "location aware", "job portals", "Lahore", "Pakistan", "Next.js"],
  authors: [{ name: "faisukhan01" }],
  openGraph: {
    title: "Job Finder — Control Center",
    description: "Location-aware live job portal searches with fit ranking and tracker exports",
    siteName: "Job Finder",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
