// app/unauthorized/page.tsx

"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
export default function UnauthorizedPage() {
  const { data: session } = useSession();

  const clearCookies = async () => {
    // Clear all accessible cookies
    document.cookie.split(';').forEach(cookie => {
      const name = cookie.split('=')[0].trim();
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });
    // Sign out and redirect with cache-busting parameter to avoid cached redirects
    await signOut({ callbackUrl: `/login?t=${Date.now()}` });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <ShieldAlert className="w-16 h-16 text-red-500" />
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-black">
            {session?.user
              ? "You don't have permission to access this page. Admin privileges are required."
              : "Please log in with an admin account to access this page."}
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              className="inline-block px-4 py-2 bg-black text-white rounded hover:opacity-90"
            >
              Go to Home
            </Link>
            {!session?.user && (
              <Link
                href="/login"
                className="inline-block px-4 py-2 border border-black text-black rounded hover:bg-black/10"
              >
                Log In
              </Link>
            )}
            <button
              onClick={clearCookies}
              className="px-4 py-2 text-sm text-black border border-gray-400 rounded hover:border-black transition-colors"
            >
              Clear Cookies
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
