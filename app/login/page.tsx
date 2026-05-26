// app/login/page.tsx
// Redirect to root - login is only accessible within a league tenant (/l/[leagueSlug]/login)

import { redirect } from "next/navigation";

export default function LoginPage() {
  redirect("/");
}
