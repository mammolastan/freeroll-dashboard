// app/privacy-policy/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Open Bar League",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
          Privacy Policy
        </h1>
        <p className="text-slate-400 mb-10">Last updated: July 5, 2026</p>

        <div className="bg-slate-800 rounded-lg p-6 md:p-8 border border-slate-700 space-y-8">
          <p className="text-slate-300 leading-relaxed">
            Open Bar League (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates
            openbarleague.com (the &quot;Site&quot;). This Privacy Policy explains
            what information we collect and how we use it.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-cyan-400 mb-2">
              Information We Collect
            </h2>
            <p className="text-slate-300 leading-relaxed">
              We do not collect, store, or sell personal data beyond what is
              necessary to operate the Site and our SMS notifications.
            </p>
            <p className="text-slate-300 leading-relaxed mt-3">
              If you sign up for SMS updates, we collect your phone number
              solely to send you the messages you&apos;ve opted into. We do not
              share your phone number with third parties other than our SMS
              service provider (Twilio), which processes it only to deliver
              messages on our behalf.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cyan-400 mb-2">
              SMS Communications
            </h2>
            <p className="text-slate-300 leading-relaxed">
              By providing your phone number and opting in, you consent to
              receive text messages from Open Bar League. Message and data
              rates may apply. You can opt out at any time by replying STOP to
              any message, or by contacting us at{" "}
              
               <a href="mailto:freerollatlantapoker@gmail.com"
                className="text-cyan-400 hover:text-cyan-300 underline"
              >
                freerollatlantapoker@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cyan-400 mb-2">
              Cookies &amp; Analytics
            </h2>
            <p className="text-slate-300 leading-relaxed">
              The Site does not use tracking cookies or third-party analytics
              beyond what may be required for basic site functionality.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cyan-400 mb-2">
              Data Security
            </h2>
            <p className="text-slate-300 leading-relaxed">
              We take reasonable measures to protect any information you
              provide, but no method of transmission or storage is 100%
              secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cyan-400 mb-2">
              Children&apos;s Privacy
            </h2>
            <p className="text-slate-300 leading-relaxed">
              The Site is not directed at children under 13, and we do not
              knowingly collect information from children.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cyan-400 mb-2">
              Changes to This Policy
            </h2>
            <p className="text-slate-300 leading-relaxed">
              We may update this Privacy Policy from time to time. Changes
              will be posted on this page with an updated &quot;Last
              updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-cyan-400 mb-2">
              Contact Us
            </h2>
            <p className="text-slate-300 leading-relaxed">
              Questions about this Privacy Policy? Contact us at{" "}
              
                <a href="mailto:freerollatlantapoker@gmail.com"
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
