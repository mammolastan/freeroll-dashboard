import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Freeroll Atlanta Poker Player Dashboard</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <Link href="/players">
          <Card className="hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle>Player Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <p>View detailed player statistics, rankings, and history</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/venues">
          <Card className="hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle>Venue Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Explore venue statistics, trends, and player performance</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </main>
  )
}