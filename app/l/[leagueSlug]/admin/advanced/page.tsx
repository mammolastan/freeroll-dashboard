// app/l/[leagueSlug]/admin/advanced/page.tsx

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLeagueIdBySlug } from '@/lib/league-utils';
import { getLeagueRole } from '@/lib/league-auth';
import AdvancedSettingsForm from '@/components/admin/AdvancedSettingsForm';

interface PageProps {
  params: Promise<{ leagueSlug: string }>;
}

export default async function AdvancedSettingsPage({ params }: PageProps) {
  const { leagueSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.uid) {
    redirect(`/l/${leagueSlug}`);
  }

  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    redirect('/');
  }

  // Only owners can access this page
  const role = await getLeagueRole(session.user.uid, leagueId);
  if (role !== 'owner') {
    redirect(`/l/${leagueSlug}/admin`);
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-white mb-1">Advanced</h2>
      <p className="text-white/40 text-sm mb-8">
        Advanced settings for league owners. Use with caution.
      </p>
      <AdvancedSettingsForm leagueSlug={leagueSlug} />
    </div>
  );
}
