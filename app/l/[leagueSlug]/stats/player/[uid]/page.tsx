import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import PlayerHistory from '@/components/AdvancedStats/PlayerHistory';

interface PageProps {
  params: Promise<{ leagueSlug: string; uid: string }>;
}

export default async function PlayerHistoryPage({ params }: PageProps) {
  const { leagueSlug, uid } = await params;
  const session = await getServerSession(authOptions);

  // Get player info
  const player = await prisma.players_v2.findUnique({
    where: { uid },
    select: {
      first_name: true,
      last_name: true,
      nickname: true,
      photo_url: true,
    },
  });

  if (!player) {
    notFound();
  }

  const playerName = `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown Player';
  const isOwnProfile = session?.user?.uid === uid;

  return (
    <PlayerHistory
      leagueSlug={leagueSlug}
      playerUid={uid}
      playerName={playerName}
      playerNickname={player.nickname}
      playerPhotoUrl={player.photo_url}
      isOwnProfile={isOwnProfile}
    />
  );
}
