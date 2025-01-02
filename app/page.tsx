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

            </CardContent>
          </Card>
        </Link>

        <Link href="/venues">
          <Card className="hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle>Venues</CardTitle>
            </CardHeader>
            <CardContent>

            </CardContent>
          </Card>
        </Link>

        <Link href="/games">
          <Card className="hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle>Games</CardTitle>
            </CardHeader>
            <CardContent>

            </CardContent>
          </Card>
        </Link>
      </div>
    </main>
  )
}