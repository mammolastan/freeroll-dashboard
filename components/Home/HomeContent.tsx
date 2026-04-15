// components/Home/HomeContent.tsx
"use client";

interface HomeContentProps {
  prefix?: string;
  leagueName?: string;
}

export default function HomeContent({ leagueName }: HomeContentProps) {
  const title = leagueName
    ? `${leagueName} Player Dashboard`
    : "Freeroll Atlanta Poker Player Dashboard";

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">{title}</h1>
    </main>
  );
}
