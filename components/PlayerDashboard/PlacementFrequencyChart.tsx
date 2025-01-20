import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { Trophy } from 'lucide-react';

interface PlacementFrequencyData {
    placement: number;
    frequency: number;
}

interface PlacementFrequencyProps {
    data: PlacementFrequencyData[];
}

export function PlacementFrequencyChart({ data }: PlacementFrequencyProps) {
    // Fill in missing placements with 0 frequency
    const completeData = Array.from({ length: 8 }, (_, i) => {
        const existing = data.find(d => d.placement === i + 1);
        return {
            placement: i + 1,
            frequency: existing ? existing.frequency : 0,
            label: getPlacementLabel(i + 1)
        };
    });

    return (
        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300">
            <div className="bg-purple-50 p-4 rounded-t-xl border-b border-purple-100">
                <h3 className="font-bold text-lg text-purple-900 flex items-center gap-2">

                    Placement Frequency
                </h3>
            </div>
            <div className="p-4">
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={completeData} margin={{ top: 0, right: 0, left: 0, bottom: 5 }}>
                            <XAxis
                                dataKey="label"
                                tick={{ fontSize: 12 }}
                            />
                            <YAxis
                                tick={{ fontSize: 12 }}
                                allowDecimals={false}
                            />
                            <Tooltip
                                formatter={(value: number) => [`${value} times`, 'Frequency']}
                                labelFormatter={(label: string) => `${label} Place`}
                            />
                            <Bar
                                dataKey="frequency"
                                fill="#818cf8"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

function getPlacementLabel(placement: number): string {
    const suffixes = ['st', 'nd', 'rd', 'th'];
    const suffix = placement <= 3 ? suffixes[placement - 1] : suffixes[3];
    return `${placement}${suffix}`;
}