// app/register/page.tsx
// Redirect to root - registration is only accessible within a league tenant (/l/[leagueSlug]/register)

import { redirect } from "next/navigation";

export default function RegisterPage() {
  redirect("/");
}
