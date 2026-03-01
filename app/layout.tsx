import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNavigation } from "@/components/ui/bottom-navigation";
import { DesktopSidebar } from "@/components/ui/desktop-sidebar";
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
  title: "CarWatch - Monitor Your Dream Deals",
  description: "Track online listings and never miss a great deal",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <div className="flex h-screen overflow-hidden">
            {/* Desktop sidebar — hidden on mobile */}
            <DesktopSidebar />

            {/* Main content area */}
            <div className="flex flex-col flex-1 overflow-hidden">
              <main className="flex-1 overflow-hidden">
                {children}
              </main>
              {/* Bottom nav — mobile only */}
              <div className="md:hidden">
                <BottomNavigation />
              </div>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
