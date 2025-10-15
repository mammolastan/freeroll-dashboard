// components/Navigation/Navbar.tsx
'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import NavLink from './NavLink';
import Link from 'next/link';
import { Home, Store, CircleUserRound, Menu, X, Trophy, ChevronDown, ChevronUp, GalleryHorizontalEnd, Award, ClipboardCheck } from 'lucide-react';

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
    const [isOpen, setIsOpen] = useState(false);
    const [isRankingsOpen, setIsRankingsOpen] = useState(false);

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
        { href: '/games', icon: <GalleryHorizontalEnd size={20} />, text: 'Games' },
        { href: '/check-in', icon: <ClipboardCheck size={20} />, text: 'Check-In' },
        { href: '/players', icon: <CircleUserRound size={20} />, text: 'Players' },
        { href: '/venues', icon: <Store size={20} />, text: 'Venues' },
        { href: '/badges', icon: <Award size={20} />, text: 'Badges' },
    ];

    const handleNavigation = (href: string) => {
        router.push(href);
        setIsOpen(false);
        setIsRankingsOpen(false);
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
                                        <div className={`absolute top-full left-0 mt-2 w-48 bg-slate-700 rounded-md shadow-lg ${isRankingsOpen ? 'block' : 'hidden'}`}>
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
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default Navbar;