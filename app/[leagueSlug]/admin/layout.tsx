import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getLeagueIdBySlug } from '@/lib/league-utils';
import { getLeagueRole, canAccessAdmin, LeagueRole } from '@/lib/league-auth';
import AdminSidebar from '@/components/admin/AdminSidebar';

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ leagueSlug: string }>;
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { leagueSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.uid) {
    redirect(`/${leagueSlug}`);
  }

  const leagueId = await getLeagueIdBySlug(leagueSlug);
  if (!leagueId) {
    redirect('/');
  }

  const role = await getLeagueRole(session.user.uid, leagueId);
  if (!canAccessAdmin(role)) {
    redirect(`/${leagueSlug}`);
  }

  return (
    <div className="min-h-screen flex">
      <AdminSidebar
        leagueSlug={leagueSlug}
        role={role as LeagueRole}
      />
      <main className="flex-1 p-6 pt-16 md:pt-6 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
