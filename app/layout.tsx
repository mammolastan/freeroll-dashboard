// app/layout.tsx

import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import Navbar from "@/components/Navigation/Navbar";
import { SessionProvider } from "@/components/providers/SessionProvider";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: {
    default: "Freeroll Atlanta Player Dashboard",
    template: "%s | Freeroll Atlanta",
  },
  description:
    "Dashboard for Freeroll Atlanta poker tournament player statistics",
  icons: {
    icon: [
      {
        url: "/icons/default-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        url: "/icons/default-icon-512.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],
    apple: {
      url: "/icons/default-icon-512.png",
      sizes: "180x180",
      type: "image/png",
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={cn(inter.className, "min-h-screen bg-background")}>
        <ServiceWorkerRegister />
        <SessionProvider>
          <Navbar />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
