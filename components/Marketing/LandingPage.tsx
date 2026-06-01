// components/Marketing/LandingPage.tsx
import Link from "next/link";
import FeaturesSection from "./FeaturesSection";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Leagues Section - Most Prominent */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-4">
            Open Bar League
          </h1>
          <p className="text-xl text-slate-300 text-center mb-12">
            A Bar Poker League Management Platform
          </p>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-white mb-6 text-center">
              Leagues
            </h2>
            <div className="flex justify-center">
              <Link
                href="/l/freeroll-atlanta"
                className="group block bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-cyan-500 rounded-xl p-6 transition-all duration-200 max-w-md w-full"
              >
                <div className="flex items-center gap-4">
                  <img
                    src="/images/Poker-Chip-Isloated-Blue.png"
                    alt="Freeroll Atlanta"
                    width={64}
                    height={64}
                    className="rounded-lg"
                  />
                  <div>
                    <h3 className="text-xl font-semibold text-white group-hover:text-cyan-400 transition-colors">
                      Freeroll Atlanta
                    </h3>
                    <p className="text-slate-400">Atlanta, GA</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* What is it Section */}
          <div className="mt-16 text-center">
            <h2 className="text-2xl font-semibold text-white mb-4">
              What is it?
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Most poker tourney tools are too complex. Open Bar League is built
              for simplicity, designed for owners who need less busywork, TDs
              who need a dead-simple game console, and players who actually want
              to stay engaged with live scoring, rankings, and more.
            </p>
          </div>
        </div>
      </section>

      <FeaturesSection />

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-slate-500">
        <p>Open Bar League</p>
      </footer>
    </div>
  );
}
