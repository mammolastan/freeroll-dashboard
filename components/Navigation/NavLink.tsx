'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface NavLinkProps {
    href: string;
    icon: LucideIcon;
    text: string;
}

// NavLink Component with active state handling
const NavLink = ({ href, icon: Icon, text }: NavLinkProps) => {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
        <Link
            href={href}
            className={`flex items-center space-x-2 transition-colors ${isActive
                ? 'text-blue-300'
                : 'hover:text-blue-300'
                }`}
        >
            <Icon size={20} />
            <span>{text}</span>
        </Link>
    );
};

export default NavLink;