'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import NavLink from './NavLink';
import Link from 'next/link';
import { Home, Store, User, CircleUserRound, Menu, X } from 'lucide-react';

const Navbar = () => {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);

    const navLinks = [
        { href: '/', icon: <Home size={20} />, text: 'Home' },
        { href: '/players', icon: <CircleUserRound size={20} />, text: 'Players' },
        { href: '/venues', icon: <Store size={20} />, text: 'Venues' },
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
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default Navbar;