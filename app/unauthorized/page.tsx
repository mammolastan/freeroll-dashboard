"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function UnauthorizedPage() {
  const { data: session } = useSession();

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
          <p className="text-muted-foreground">
            {session?.user
              ? "You don't have permission to access this page. Admin privileges are required."
              : "Please log in with an admin account to access this page."}
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
            >
              Go to Home
            </Link>
            {!session?.user && (
              <Link
                href="/login"
                className="inline-block px-4 py-2 border border-primary text-primary rounded hover:bg-primary/10"
              >
                Log In
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
