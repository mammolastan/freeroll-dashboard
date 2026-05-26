// app/profile/page.tsx
// Redirect to root - profile is only accessible within a league tenant (/l/[leagueSlug]/profile)

import { redirect } from "next/navigation";

export default function ProfilePage() {
  redirect("/");
}
