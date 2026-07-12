// app/l/[leagueSlug]/register/page.tsx

"use client";

import { useState, useEffect, use } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PlayerSuggestion {
  uid: string;
  name: string;
  nickname: string | null;
}

export default function RegisterPage({
  params,
}: {
  params: Promise<{ leagueSlug: string }>;
}) {
  const { leagueSlug } = use(params);
  const router = useRouter();
  const prefix = `/l/${leagueSlug}`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // For claiming existing player
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlayerSuggestion[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSuggestion | null>(
    null
  );
  const [isNewPlayer, setIsNewPlayer] = useState(false);

  // Search for existing players
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/players/search?q=${encodeURIComponent(searchQuery)}&unclaimed=true`
        );
        const data = await res.json();
        setSuggestions(data.players || []);
      } catch (err) {
        console.error("Search error:", err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!selectedPlayer && !isNewPlayer) {
      setError("Select your existing player profile or register as new");
      return;
    }

    if (isNewPlayer && name.trim().length < 2) {
      setError("Please enter your name");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: isNewPlayer ? name : undefined,
          existingPlayerUid: selectedPlayer?.uid,
          phone_number: phoneNumber || undefined,
          sms_opt_in: smsOptIn,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      // Auto sign-in after registration
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        router.push(`${prefix}/login`);
      } else {
        router.push(`${prefix}/profile`);
        router.refresh();
      }
    } catch (err) {
      setError("Something went wrong:" + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
          Create Account
        </h1>
        <p className="text-sm text-gray-600 mb-3">
          Register your email address with your existing player profile or
          create a new one.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email & Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Re-enter password"
            />
          </div>

          {/* Player Selection Section */}
          <div className="border-t pt-4 mt-4">
            <p className="text-sm text-gray-600 mb-3">
              Search for your existing player profile to link it to your
              account, or register as a new player.
            </p>

            {!isNewPlayer && !selectedPlayer && (
              <>
                <div className="mb-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoComplete="off"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Search for your name..."
                  />
                </div>

                {suggestions.length > 0 && (
                  <div className="mb-3 border rounded-md max-h-40 overflow-y-auto">
                    {suggestions.map((player) => (
                      <button
                        key={player.uid}
                        type="button"
                        onClick={() => {
                          setSelectedPlayer(player);
                          setSearchQuery("");
                          setSuggestions([]);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-100 text-gray-900 border-b last:border-b-0"
                      >
                        {player.name}
                        {player.nickname && (
                          <span className="text-gray-500 ml-2">
                            ({player.nickname})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsNewPlayer(true)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  I&apos;m a new player
                </button>
              </>
            )}

            {selectedPlayer && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-800">
                  Linking account to: <strong>{selectedPlayer.name}</strong>
                  {selectedPlayer.nickname && ` (${selectedPlayer.nickname})`}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedPlayer(null)}
                  className="text-sm text-green-600 hover:underline mt-1"
                >
                  Choose different player
                </button>
              </div>
            )}

            {isNewPlayer && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your name"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewPlayer(false)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Actually, I&apos;ve played before
                </button>
              </div>
            )}
          </div>

          {/* SMS Opt-In */}
          <div className="border-t pt-4 mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                autoComplete="tel"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="(404) 555-0100"
              />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={smsOptIn}
                onChange={(e) => setSmsOptIn(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">
                I agree to receive SMS announcements from Freeroll Atlanta Poker League. Message frequency varies. Msg &amp; Data rates may apply. Reply STOP to opt out, HELP for help.
              </span>
            </label>
            <p className="text-xs text-gray-500 pl-7">
              See our <Link href="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</Link> and <Link href="/terms-of-service" className="text-blue-600 hover:underline">Terms of Service</Link>.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
          >
            {isLoading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-600">
          Already have an account?{" "}
          <Link href={`${prefix}/login`} className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
