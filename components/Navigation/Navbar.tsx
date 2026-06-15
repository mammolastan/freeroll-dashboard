// components/Navigation/Navbar.tsx
"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import NavLink from "./NavLink";
import Link from "next/link";
import { useLeague } from "@/lib/LeagueContext";
import {
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  User,
  LogOut,
  LogIn,
  Trophy,
} from "lucide-react";
import { getNavItems, NavItem } from "@/lib/navConfig";

const Navbar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isRankingsOpen, setIsRankingsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Get league slug from context OR extract from pathname
  // Context won't be available since Navbar is rendered in root layout (outside LeagueProvider)
  // So we also check the pathname for league-prefixed routes (under /l/[leagueSlug])
  const { leagueSlug: contextSlug } = useLeague();

  // Extract league slug from pathname if not in context
  // All league routes are now under /l/[leagueSlug]/...
  const getLeagueSlugFromPath = (): string | null => {
    if (!pathname) return null;
    const segments = pathname.split("/");
    // Check for /l/[leagueSlug] pattern
    if (segments[1] === "l" && segments[2]) {
      return segments[2];
    }
    return null;
  };

  const leagueSlug = contextSlug ?? getLeagueSlugFromPath();
  const prefix = leagueSlug ? `/l/${leagueSlug}` : "";
  const isInLeague = Boolean(leagueSlug);

  // Track if component has mounted to avoid hydration mismatch
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Fetch league name when slug is detected
  const [leagueName, setLeagueName] = useState<string | null>(null);
  useEffect(() => {
    if (!leagueSlug) {
      setLeagueName(null);
      return;
    }
    fetch(`/api/leagues/${leagueSlug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setLeagueName(data?.name ?? null))
      .catch(() => setLeagueName(null));
  }, [leagueSlug]);

  // Hide navbar on fullscreen pages like tvscreen
  if (pathname?.includes("/tvscreen")) {
    return null;
  }

  const toggleMenu = () => setIsOpen(!isOpen);

  // Nav links use prefix for league-scoped routes - only show when in a league
  const navLinks = isInLeague ? getNavItems(prefix) : [];

  const handleNavigation = (href: string) => {
    router.push(href);
    setIsOpen(false);
    setIsRankingsOpen(false);
  };

  const handleSignOut = () => {
    setIsUserMenuOpen(false);
    setIsOpen(false);
    signOut({ callbackUrl: prefix || "/" });
  };

  return (
    <nav className="bg-theme-surface text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <Link
            href={isInLeague ? `${prefix}/` : "/"}
            className="flex items-center gap-2 text-xl font-bold truncate"
          >
            {!isInLeague && (
              <img
                src="/icons/default-icon-512.png"
                alt=""
                className="w-8 h-8"
              />
            )}
            {isInLeague
              ? (hasMounted && leagueName ? `${leagueName} Player Dashboard` : "Player Dashboard")
              : "Open Bar League"}
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {navLinks.map((link) => (
              <div
                key={link.text}
                className="relative"
              >
                {link.children ? (
                  <div className="relative group">
                    <button
                      className="flex items-center space-x-2 hover:text-theme-primary transition-colors"
                      onClick={() => setIsRankingsOpen(!isRankingsOpen)}
                    >
                      <link.icon size={20} />
                      <span>{link.text}</span>
                      {isRankingsOpen ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </button>
                    <div
                      className={`absolute top-full left-0 mt-2 w-48 bg-theme-surface-hover rounded-md shadow-lg z-50 ${isRankingsOpen ? "block" : "hidden"}`}
                    >
                      {link.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="block px-4 py-2 text-sm hover:bg-slate-600"
                          onClick={() => setIsRankingsOpen(false)}
                        >
                          {child.text}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <NavLink
                    href={link.href}
                    icon={link.icon}
                    text={link.text}
                  />
                )}
              </div>
            ))}

            {/* Auth Section - Desktop (only show in league context) */}
            {isInLeague && (
              <div className="relative ml-4 pl-4 border-l border-slate-600">
                {status === "loading" ? (
                  <div className="w-8 h-8 rounded-full bg-slate-600 animate-pulse" />
                ) : session ? (
                  <div className="relative">
                    <button
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      className="flex items-center space-x-2 hover:text-theme-primary transition-colors"
                    >
                      {session.user.image ? (
                        <div
                          className="w-8 h-8 rounded-full bg-slate-600 bg-cover bg-center flex-shrink-0"
                          style={{
                            backgroundImage: `url(${session.user.image})`,
                          }}
                          role="img"
                          aria-label="Profile"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                          <User size={16} />
                        </div>
                      )}
                      <span className="max-w-[100px] truncate">
                        {session.user.nickname ||
                          session.user.name?.split(" ")[0] ||
                          "Account"}
                      </span>
                      <ChevronDown size={16} />
                    </button>

                    {/* User Dropdown */}
                    {isUserMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-theme-surface-hover rounded-md shadow-lg z-50">
                        <Link
                          href={`${prefix}/profile`}
                          className="flex items-center space-x-2 px-4 py-2 text-sm hover:bg-slate-600"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <User size={16} />
                          <span>My Profile</span>
                        </Link>
                        <Link
                          href={`${prefix}/players?uid=${session.user.uid}`}
                          className="flex items-center space-x-2 px-4 py-2 text-sm hover:bg-slate-600"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <Trophy size={16} />
                          <span>My Stats</span>
                        </Link>
                        <hr className="border-slate-600 my-1" />
                        <button
                          onClick={handleSignOut}
                          className="flex items-center space-x-2 px-4 py-2 text-sm hover:bg-slate-600 w-full text-left text-red-400"
                        >
                          <LogOut size={16} />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <Link
                      href={`${prefix}/login`}
                      className="flex items-center space-x-1 hover:text-theme-primary transition-colors"
                    >
                      <LogIn size={18} />
                      <span>Sign In</span>
                    </Link>
                    <Link
                      href={`${prefix}/register`}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-md text-sm transition-colors"
                    >
                      Register
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Menu Button - only show when in a league (has nav items) */}
          {isInLeague && (
            <div className="md:hidden">
              <button
                onClick={toggleMenu}
                className="p-2 rounded-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-white"
                aria-expanded={isOpen}
                aria-label="Toggle menu"
              >
                {isOpen ? (
                  <X size={24} />
                ) : session?.user ? (
                  session.user.image ? (
                    <div
                      className="w-8 h-8 rounded-full bg-slate-600 bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${session.user.image})`,
                      }}
                      role="img"
                      aria-label="Profile"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                      <User size={16} />
                    </div>
                  )
                ) : (
                  <Menu size={24} />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navLinks.map((link) => (
                <div key={link.text}>
                  {link.children ? (
                    <>
                      <button
                        onClick={() => setIsRankingsOpen(!isRankingsOpen)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-md text-base font-medium hover:bg-slate-700"
                      >
                        <div className="flex items-center space-x-2">
                          <link.icon size={20} />
                          <span>{link.text}</span>
                        </div>
                        {isRankingsOpen ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </button>
                      {isRankingsOpen && (
                        <div className="pl-6 space-y-1">
                          {link.children.map((child) => (
                            <button
                              key={child.href}
                              onClick={() => handleNavigation(child.href)}
                              className="w-full text-left px-3 py-2 text-base font-medium hover:bg-slate-700 rounded-md"
                            >
                              {child.text}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={link.href}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium
                                                ${
                                                  pathname === link.href
                                                    ? "bg-slate-700 text-white"
                                                    : "hover:bg-slate-700"
                                                }`}
                      onClick={() => setIsOpen(false)}
                    >
                      <link.icon size={20} />
                      <span>{link.text}</span>
                    </Link>
                  )}
                </div>
              ))}

              {/* Auth Section - Mobile (only show in league context) */}
              {isInLeague && (
                <div className="pt-4 mt-4 border-t border-slate-600">
                  {status === "loading" ? (
                    <div className="px-3 py-2">
                      <div className="w-full h-10 bg-slate-700 rounded animate-pulse" />
                    </div>
                  ) : session ? (
                    <>
                      <div className="px-3 py-2 flex items-center space-x-3">
                        {session.user.image ? (
                          <div
                            className="w-10 h-10 rounded-full bg-slate-600 bg-cover bg-center flex-shrink-0"
                            style={{
                              backgroundImage: `url(${session.user.image})`,
                            }}
                            role="img"
                            aria-label="Profile"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                            <User size={20} />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">
                            {session.user.nickname || session.user.name}
                          </p>
                          <p className="text-sm text-slate-400">
                            {session.user.email}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`${prefix}/profile`}
                        className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-slate-700"
                        onClick={() => setIsOpen(false)}
                      >
                        <User size={20} />
                        <span>My Profile</span>
                      </Link>
                      <Link
                        href={`${prefix}/players?uid=${session.user.uid}`}
                        className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-slate-700"
                        onClick={() => setIsOpen(false)}
                      >
                        <Trophy size={20} />
                        <span>My Stats</span>
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-slate-700 text-red-400"
                      >
                        <LogOut size={20} />
                        <span>Sign Out</span>
                      </button>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Link
                        href={`${prefix}/login`}
                        className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-slate-700"
                        onClick={() => setIsOpen(false)}
                      >
                        <LogIn size={20} />
                        <span>Sign In</span>
                      </Link>
                      <Link
                        href={`${prefix}/register`}
                        className="flex items-center justify-center space-x-2 mx-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-md"
                        onClick={() => setIsOpen(false)}
                      >
                        <span>Create Account</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close dropdowns - only for desktop */}
      {!isOpen && (isUserMenuOpen || isRankingsOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsUserMenuOpen(false);
            setIsRankingsOpen(false);
          }}
        />
      )}
    </nav>
  );
};

export default Navbar;
