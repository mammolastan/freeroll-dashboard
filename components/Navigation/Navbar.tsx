'use client';

import { usePathname } from 'next/navigation';
import NavLink from './NavLink';
import Link from 'next/link';
import { Home, Store, User, CircleUserRound } from 'lucide-react';

// Navbar Component
const Navbar = () => {
    const pathname = usePathname();

    return (
        <nav className="bg-slate-800 text-white p-4 shadow-md">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                {/* Logo/Brand */}
                <Link href="/" className="text-xl font-bold">
                    Freeroll Atlanta Player Dashboard
                </Link>

                {/* Navigation Links */}
                <div className="flex items-center space-x-6">
                    <NavLink href="/" icon={<Home size={20} />} text="Home" />
                    <NavLink href="/players" icon={<CircleUserRound size={20} />} text="players" />
                    <NavLink href="/venues" icon={<Store size={20} />} text="venues" />
                </div>
            </div>
        </nav>
    );
};

export default Navbar;