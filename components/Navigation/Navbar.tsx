// components/Navigation/Navbar.tsx

"use client"

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import NavLink from './NavLink';
import Link from 'next/link';
import { Home, Store, User, CircleUserRound, Menu, X, ChevronDown, Trophy } from 'lucide-react';

const Navbar = () => {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [isRankingsOpen, setIsRankingsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const toggleMenu = () => setIsOpen(!isOpen);
    const toggleRankings = () => setIsRankingsOpen(!isRankingsOpen);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsRankingsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const navLinks = [
        { href: '/', icon: <Home size={20} />, text: 'Home' },
        { href: '/players', icon: <CircleUserRound size={20} />, text: 'Players' },
        { href: '/venues', icon: <Store size={20} />, text: 'Venues' },
    ];

    const rankingsLinks = [
        { href: '/rankings/monthly', text: 'Monthly Rankings' },
        { href: '/rankings/quarterly', text: 'Quarterly Rankings' },
    ];

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
                            <NavLink
                                key={link.href}
                                href={link.href}
                                icon={link.icon}
                                text={link.text}
                            />
                        ))}

                        {/* Rankings Dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={toggleRankings}
                                className={`flex items-center space-x-2 transition-colors ${pathname?.startsWith('/rankings/')
                                    ? 'text-blue-300'
                                    : 'text-white hover:text-blue-300'
                                    }`}
                            >
                                <Trophy size={20} />
                                <span>Rankings</span>
                                <ChevronDown
                                    size={16}
                                    className={`transform transition-transform ${isRankingsOpen ? 'rotate-180' : ''
                                        }`}
                                />
                            </button>

                            {/* Desktop Dropdown Menu */}
                            {isRankingsOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                                    {rankingsLinks.map((link) => (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            className={`block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100
                                                ${pathname === link.href ? 'bg-gray-100' : ''}`}
                                            onClick={() => setIsRankingsOpen(false)}
                                        >
                                            {link.text}
                                        </Link>
                                    ))}
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
                                <Link
                                    key={link.href}
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
                            ))}

                            {/* Mobile Rankings Section */}
                            <div className="px-3 py-2">
                                <button
                                    onClick={toggleRankings}
                                    className={`flex items-center space-x-2 w-full text-left font-medium ${pathname?.startsWith('/rankings/') ? 'text-blue-300' : ''
                                        }`}
                                >
                                    <Trophy size={20} />
                                    <span>Rankings</span>
                                    <ChevronDown
                                        size={16}
                                        className={`transform transition-transform ${isRankingsOpen ? 'rotate-180' : ''
                                            }`}
                                    />
                                </button>

                                {isRankingsOpen && (
                                    <div className="pl-8 mt-2 space-y-2">
                                        {rankingsLinks.map((link) => (
                                            <Link
                                                key={link.href}
                                                href={link.href}
                                                className={`block py-2 text-sm
                                                    ${pathname === link.href
                                                        ? 'text-blue-300'
                                                        : 'hover:text-blue-300'
                                                    }`}
                                                onClick={() => setIsOpen(false)}
                                            >
                                                {link.text}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default Navbar;