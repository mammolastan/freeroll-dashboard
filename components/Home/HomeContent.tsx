// components/Home/HomeContent.tsx
'use client';

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface HomeContentProps {
  prefix?: string;
  leagueName?: string;
}

export default function HomeContent({ prefix = '', leagueName }: HomeContentProps) {
  const title = leagueName
    ? `${leagueName} Player Dashboard`
    : 'Freeroll Atlanta Poker Player Dashboard';

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">{title}</h1>

      <div className="grid md:grid-cols-2 gap-6">

        <Link href={`${prefix}/rankings/monthly`}>
          <Card className="hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle>Monthly rankings</CardTitle>
            </CardHeader>
            <CardContent>

            </CardContent>
          </Card>
        </Link>

        <Link href={`${prefix}/rankings/quarterly`}>
          <Card className="hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle>Quarterly rankings</CardTitle>
            </CardHeader>
            <CardContent>

            </CardContent>
          </Card>
        </Link>

        <Link href={`${prefix}/players`}>
          <Card className="hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle>Player Statistics</CardTitle>
            </CardHeader>
            <CardContent>

            </CardContent>
          </Card>
        </Link>

        <Link href={`${prefix}/venues`}>
          <Card className="hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle>Venues</CardTitle>
            </CardHeader>
            <CardContent>

            </CardContent>
          </Card>
        </Link>

        <Link href={`${prefix}/games`}>
          <Card className="hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle>Games</CardTitle>
            </CardHeader>
            <CardContent>

            </CardContent>
          </Card>
        </Link>

        <Link href={`${prefix}/badges`}>
          <Card className="hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle>Badges</CardTitle>
            </CardHeader>
            <CardContent>

            </CardContent>
          </Card>
        </Link>

      </div>

    </main>
  )
}
