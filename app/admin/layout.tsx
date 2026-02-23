// app/admin/layout.tsx
// Defense-in-depth: middleware handles redirects, this is a backup check
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { authOptions } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // Debug logging - check your terminal
  console.log("[AdminLayout]", {
    hasSession: !!session,
    user: session?.user ? {
      email: session.user.email,
      isAdmin: session.user.isAdmin,
    } : null,
  });

  if (!session) {
    console.log("[AdminLayout] No session, redirecting to login");
    // Get current path from headers for proper callback
    const headersList = await headers();
    const pathname = headersList.get("x-invoke-path") || "/admin";
    redirect(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
  }

  if (!session.user?.isAdmin) {
    console.log("[AdminLayout] User is not admin, redirecting to unauthorized");
    redirect("/unauthorized");
  }

  console.log("[AdminLayout] Access granted");
  return <>{children}</>;
}
