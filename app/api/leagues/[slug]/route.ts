// app/api/leagues/[slug]/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const league = await prisma.leagues.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, is_active: true },
  });

  if (!league || !league.is_active) {
    return NextResponse.json({ error: 'League not found' }, { status: 404 });
  }

  return NextResponse.json(league);
}
