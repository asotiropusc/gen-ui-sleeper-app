import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import SilkWrapper from "@/components/app/SilkWrapper";
import Providers from "./providers";
import { Toaster } from "sonner";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Sleeper Sage",
  description: "A league history analyzer for Sleeper fantasy football leagues",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.className} relative min-h-screen overflow-hidden antialiased`}
      >
        <Providers>
          <div className="fixed inset-0 -z-10">
            <SilkWrapper />
          </div>

          <div className="relative z-0">{children}</div>
        </Providers>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
