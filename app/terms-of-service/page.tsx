// app/terms-of-service/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Open Bar League",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
          Terms of Service
        </h1>
        <p className="text-slate-400 mb-10">Last updated: July 5, 2026</p>

        <div className="bg-slate-800 rounded-lg p-6 md:p-8 border border-slate-700 space-y-8">
          <p className="text-slate-300 leading-relaxed">
            Welcome to Open Bar League (&quot;we&quot;, &quot;us&quot;,
            &quot;our&quot;), accessible at openbarleague.com (the
            &quot;Site&quot;). By using the Site, you agree to these Terms of
            Service. If you do not agree, please do not use the Site.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-cyan-400 mb-2">
              Use of the Site
            </h2>
            <p className="text-slate-300 leading-relaxed">
              You agree to use the Site only for lawful purposes and in a way
              that does not infringe the rights of others or restrict their
              use of the Site.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cyan-400 mb-2">
              SMS Program
            </h2>
            <p className="text-slate-300 leading-relaxed">
              By opting into our SMS program, you agree to receive text
              messages from Open Bar League related to updates, events, and
              notifications. Message and data rates may apply. You can opt
              out at any time by replying STOP. See our{" "}
              <Link
                href="/privacy-policy"
                className="text-cyan-400 hover:text-cyan-300 underline"
              >
                Privacy Policy
              </Link>{" "}
              for more details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cyan-400 mb-2">
              No Warranty
            </h2>
            <p className="text-slate-300 leading-relaxed">
              The Site is provided &quot;as is&quot; without warranties of any
              kind, express or implied. We do not guarantee the Site will be
              error-free or uninterrupted.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cyan-400 mb-2">
              Limitation of Liability
            </h2>
            <p className="text-slate-300 leading-relaxed">
              To the fullest extent permitted by law, Open Bar League shall
              not be liable for any indirect, incidental, or consequential
              damages arising from your use of the Site.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cyan-400 mb-2">
              Changes to These Terms
            </h2>
            <p className="text-slate-300 leading-relaxed">
              We may update these Terms from time to time. Continued use of
              the Site after changes are posted constitutes acceptance of the
              new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cyan-400 mb-2">
              Contact Us
            </h2>
            <p className="text-slate-300 leading-relaxed">
              Questions about these Terms? Contact us at{" "}
              
                href="mailto:freerollatlantapoker@gmail.com"
                className="text-cyan-400 hover:text-cyan-300 underline"
              >
                freerollatlantapoker@gmail.com
              </a>
              .
            </p>
          </section>
        </div>

        <Link
          href="/"
          className="inline-block mt-8 text-cyan-400 hover:text-cyan-300"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
