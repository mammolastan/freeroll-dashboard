// components/Marketing/FeaturesSection.tsx
import FeatureCard, { Feature } from "./FeatureCard";

const features: Feature[] = [
  {
    title: "Automatic Scoring & Rankings",
    description:
      "Season standings and per-game scores calculate themselves. Zero spreadsheets, zero math. Player and venue stats are automatically updated without any extra work by the league owner.",
  },
  {
    title: "Dead simple interface and updates",
    description:
      "Battle-tested in real environments, this platform has evolved to make it as easy as possible for the TD to control KOs, timer and game info.",
  },
  {
    title: "Big-Screen Display, No Hardware",
    description:
      "Put it on the big screen. Real-time game timer, blinds, and chat on any TV or display device.",
  },
  {
    title: "Use any device",
    description:
      "Register players, seat assignments, bust-outs, and final standings from across cell phone, laptop or tablet.",
  },
  {
    title: "Tournament Director Console",
    description:
      "Register players, seat assignments, bust-outs, and final standings from across cell phone, laptop or tablet.",
  },
  {
    title: "Backed up in the cloud",
    description:
      "All your league’s game data safe in the cloud. No local storage or management of files.",
  },
];

export default function FeaturesSection() {
  return (
    <section className="py-12 px-4 bg-slate-800/50">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold text-white mb-8 text-center">
          Features
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              feature={feature}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
