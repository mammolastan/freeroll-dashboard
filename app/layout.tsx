import "./globals.css"
import { Inter } from "next/font/google"
import { cn } from "@/lib/utils"
import Navbar from "@/components/Navigation/Navbar"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Freeroll Atlanta Player Dashboard",
  description: "Dashboard for Freeroll Atlanta poker tournament player statistics",
  icons: {
    icon: [
      {
        url: '/images/Poker-Chip-Isloated-Blue.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/images/Poker-Chip-Isloated-Blue.png',
        sizes: '16x16',
        type: 'image/png',
      }
    ],
    apple: {
      url: '/images/Poker-Chip-Isloated-Blue.png',
      sizes: '180x180',
      type: 'image/png',
    }
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={cn(inter.className, "min-h-screen bg-background")}>
        <Navbar />
        {children}
      </body>
    </html>
  )
}