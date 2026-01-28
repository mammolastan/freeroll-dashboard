// components/Navigation/Navbar.tsx
'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import NavLink from './NavLink';
import Link from 'next/link';
import {
    Home,
    Store,
    CircleUserRound,
    Menu,
    X,
    Trophy,
    ChevronDown,
    ChevronUp,
    GalleryHorizontalEnd,
    Award,
    ClipboardCheck,
    User,
    LogOut,
    LogIn
} from 'lucide-react';

interface NavItem {
    href: string;
    icon: React.ReactNode;
    text: string;
    children?: Array<{
        href: string;
        text: string;
    }>;
}

const Navbar = () => {
    const pathname = usePathname();
    const router = useRouter();
    const { data: session, status } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [isRankingsOpen, setIsRankingsOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    // Hide navbar on fullscreen pages like tvscreen
    if (pathname?.startsWith('/tvscreen')) {
        return null;
    }

    const toggleMenu = () => setIsOpen(!isOpen);

    const navLinks: NavItem[] = [
        { href: '/', icon: <Home size={20} />, text: 'Home' },
        {
            href: '#',
            icon: <Trophy size={20} />,
            text: 'Rankings',
            children: [
                { href: '/rankings/monthly', text: 'Monthly Rankings' },
                { href: '/rankings/quarterly', text: 'Quarterly Rankings' }
            ]
        },
        { href: '/games', icon: <GalleryHorizontalEnd size={20} />, text: 'Recent Games' },
        { href: '/check-in', icon: <ClipboardCheck size={20} />, text: 'Active Games' },
        { href: '/players', icon: <CircleUserRound size={20} />, text: 'Players' },
        { href: '/venues', icon: <Store size={20} />, text: 'Venues' },
        { href: '/badges', icon: <Award size={20} />, text: 'Badges' },
    ];

    const handleNavigation = (href: string) => {
        router.push(href);
        setIsOpen(false);
        setIsRankingsOpen(false);
    };

    const handleSignOut = () => {
        setIsUserMenuOpen(false);
        setIsOpen(false);
        signOut({ callbackUrl: '/' });
    };

    return (
        <nav className="bg-slate-800 text-white shadow-md">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    {/* Logo/Brand */}
                    <Link href="/" className="text-xl font-bold truncate">
                        Freeroll Atlanta Player Dashboard
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-6">
                        {navLinks.map((link) => (
                            <div key={link.text} className="relative">
                                {link.children ? (
                                    <div className="relative group">
                                        <button
                                            className="flex items-center space-x-2 hover:text-blue-300 transition-colors"
                                            onClick={() => setIsRankingsOpen(!isRankingsOpen)}
                                        >
                                            {link.icon}
                                            <span>{link.text}</span>
                                            {isRankingsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                        <div className={`absolute top-full left-0 mt-2 w-48 bg-slate-700 rounded-md shadow-lg z-50 ${isRankingsOpen ? 'block' : 'hidden'}`}>
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

                        {/* Auth Section - Desktop */}
                        <div className="relative ml-4 pl-4 border-l border-slate-600">
                            {status === 'loading' ? (
                                <div className="w-8 h-8 rounded-full bg-slate-600 animate-pulse" />
                            ) : session ? (
                                <div className="relative">
                                    <button
                                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                        className="flex items-center space-x-2 hover:text-blue-300 transition-colors"
                                    >
                                        {session.user.image ? (
                                            <div
                                                className="w-8 h-8 rounded-full bg-slate-600 bg-cover bg-center flex-shrink-0"
                                                style={{ backgroundImage: `url(${session.user.image})` }}
                                                role="img"
                                                aria-label="Profile"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                                                <User size={16} />
                                            </div>
                                        )}
                                        <span className="max-w-[100px] truncate">
                                            {session.user.nickname || session.user.name?.split(' ')[0] || 'Account'}
                                        </span>
                                        <ChevronDown size={16} />
                                    </button>

                                    {/* User Dropdown */}
                                    {isUserMenuOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-48 bg-slate-700 rounded-md shadow-lg z-50">
                                            <Link
                                                href="/profile"
                                                className="flex items-center space-x-2 px-4 py-2 text-sm hover:bg-slate-600"
                                                onClick={() => setIsUserMenuOpen(false)}
                                            >
                                                <User size={16} />
                                                <span>My Profile</span>
                                            </Link>
                                            <Link
                                                href={`/players?uid=${session.user.uid}`}
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
                                        href="/login"
                                        className="flex items-center space-x-1 hover:text-blue-300 transition-colors"
                                    >
                                        <LogIn size={18} />
                                        <span>Sign In</span>
                                    </Link>
                                    <Link
                                        href="/register"
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-md text-sm transition-colors"
                                    >
                                        Register
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden">
                        <button
                            onClick={toggleMenu}
                            className="p-2 rounded-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-white"
                            aria-expanded={isOpen}
                            aria-label="Toggle menu"
                        >
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
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
                                                    {link.icon}
                                                    <span>{link.text}</span>
                                                </div>
                                                {isRankingsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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
                                                ${pathname === link.href
                                                    ? 'bg-slate-700 text-white'
                                                    : 'hover:bg-slate-700'
                                                }`}
                                            onClick={() => setIsOpen(false)}
                                        >
                                            {link.icon}
                                            <span>{link.text}</span>
                                        </Link>
                                    )}
                                </div>
                            ))}

                            {/* Auth Section - Mobile */}
                            <div className="pt-4 mt-4 border-t border-slate-600">
                                {status === 'loading' ? (
                                    <div className="px-3 py-2">
                                        <div className="w-full h-10 bg-slate-700 rounded animate-pulse" />
                                    </div>
                                ) : session ? (
                                    <>
                                        <div className="px-3 py-2 flex items-center space-x-3">
                                            {session.user.image ? (
                                                <div
                                                    className="w-10 h-10 rounded-full bg-slate-600 bg-cover bg-center flex-shrink-0"
                                                    style={{ backgroundImage: `url(${session.user.image})` }}
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
                                            href="/profile"
                                            className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-slate-700"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <User size={20} />
                                            <span>My Profile</span>
                                        </Link>
                                        <Link
                                            href={`/players?uid=${session.user.uid}`}
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
                                            href="/login"
                                            className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-slate-700"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <LogIn size={20} />
                                            <span>Sign In</span>
                                        </Link>
                                        <Link
                                            href="/register"
                                            className="flex items-center justify-center space-x-2 mx-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-md"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <span>Create Account</span>
                                        </Link>
                                    </div>
                                )}
                            </div>
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