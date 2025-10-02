import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/ui/Navbar";
import { ThemeProvider } from "@/contexts/ThemeContext";
import resumeData from "@/data/resume-data.json";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${resumeData.personal.name} - ${resumeData.tagline || 'Professional Portfolio'}`,
  description: resumeData.summary || `${resumeData.personal.name}'s professional portfolio and resume.`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              const stored = localStorage.getItem('theme-override');
              const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              const systemTheme = systemDark ? 'dark' : 'light';

              // If stored override matches system, remove it (reset to auto-follow)
              if (stored === systemTheme) {
                localStorage.removeItem('theme-override');
              }

              const theme = stored && stored !== systemTheme ? stored : systemTheme;

              if (theme === 'dark') {
                document.documentElement.classList.add('dark');
              }
            })();
          `
        }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
