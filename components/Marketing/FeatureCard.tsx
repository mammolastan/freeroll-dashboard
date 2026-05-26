// components/Marketing/FeatureCard.tsx

export interface Feature {
  title: string;
  description: string;
}

interface FeatureCardProps {
  feature: Feature;
}

export default function FeatureCard({ feature }: FeatureCardProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-cyan-400 mb-2">
        {feature.title}
      </h3>
      <p className="text-slate-400">{feature.description}</p>
    </div>
  );
}
