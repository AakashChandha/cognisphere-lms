import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CGS LMS",
  description: "Cognisphere Learning Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className={`${manrope.className} flex min-h-full flex-col`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
