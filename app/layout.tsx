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
    default: "Open Bar League: Poker League Management Platform",
    template: "%s | Open Bar League",
  },
  description:
    "Open Bar League is a poker league management platform designed to streamline the organization and administration of poker leagues. With features like player registration, league scheduling, and real-time updates, Open Bar League makes it easy for league organizers to manage their events and for players to stay informed about their standings and upcoming games.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="dark"
    >
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
