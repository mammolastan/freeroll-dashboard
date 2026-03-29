'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LeagueRole, canManageRoles } from '@/lib/league-auth';
import {
  Settings,
  MapPin,
  Trophy,
  Shield,
  Users,
  Gamepad2,
  LayoutDashboard,
  Star,
} from 'lucide-react';

interface AdminSidebarProps {
  leagueSlug: string;
  role: LeagueRole;
}

export default function AdminSidebar({ leagueSlug, role }: AdminSidebarProps) {
  const pathname = usePathname();
  const base = `/${leagueSlug}/admin`;

  const navItems = [
    { href: base,                        label: 'Dashboard',     icon: LayoutDashboard },
    { href: `${base}/settings`,          label: 'Identity',      icon: Settings },
    { href: `${base}/access`,            label: 'Access',        icon: Shield },
    { href: `${base}/scoring`,           label: 'Scoring',       icon: Trophy },
    { href: `${base}/badges`,            label: 'Badges',        icon: Star },
    { href: `${base}/venues`,            label: 'Venues',        icon: MapPin },
    { href: `${base}/game-defaults`,     label: 'Game Defaults', icon: Gamepad2 },
    ...(canManageRoles(role)
      ? [{ href: `${base}/members`, label: 'Members', icon: Users }]
      : []),
  ];

  return (
    <aside className="w-56 min-h-screen bg-black/30 border-r border-white/10 flex flex-col">
      <div className="p-4 border-b border-white/10">
        <p className="text-xs text-white/40 uppercase tracking-widest">League Admin</p>
        <p className="text-sm text-white/60 mt-1 capitalize">{role}</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
