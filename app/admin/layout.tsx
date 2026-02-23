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

  if (!session) {
    // Get current path from headers for proper callback
    const headersList = await headers();
    const pathname = headersList.get("x-invoke-path") || "/admin";
    redirect(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
  }

  if (!session.user?.isAdmin) {
    redirect("/unauthorized");
  }

  return <>{children}</>;
}
