"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface Props {
    children: ReactNode;
}

export function SessionProvider({ children }: Props) {
    return (
        <NextAuthSessionProvider refetchInterval={86400} refetchOnWindowFocus={false}>
            {children}
        </NextAuthSessionProvider>
    );
}