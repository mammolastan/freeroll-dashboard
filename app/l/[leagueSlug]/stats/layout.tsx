import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface StatsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ leagueSlug: string }>;
}

export default async function StatsLayout({ children, params }: StatsLayoutProps) {
  const { leagueSlug } = await params;
  const session = await getServerSession(authOptions);

  // Premium user = signed-in user (will change to paid user later)
  if (!session?.user?.uid) {
    redirect(`/l/${leagueSlug}/login?callbackUrl=/l/${leagueSlug}/stats`);
  }

  return <>{children}</>;
}
