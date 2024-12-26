'use client';

import React, { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';


interface NavLinkProps {
    href: string;
    icon: ReactNode;
    text: string;
}


// NavLink Component with active state handling
const NavLink = ({ href, icon, text }: NavLinkProps) => {
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
            {icon}
            <span>{text}</span>
        </Link>
    );
};

export default NavLink;