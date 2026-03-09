// components/PlayerDashboard/DateRangeSelector.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useLeagueParam } from '@/lib/useLeagueParam';

interface DateRangeOption {
    label: string;
    value: string;
    startDate: Date | null;
    endDate: Date | null;
}

interface CompetitionPeriod {
    id: number;
    name: string;
    period_type: string;
    start_date: string;
    end_date: string;
}

interface DateRangeSelectorProps {
    onRangeChange: (startDate: Date | null, endDate: Date | null, value: string) => void;
    selectedRange: string;
}

export function DateRangeSelector({ onRangeChange, selectedRange }: DateRangeSelectorProps) {
    const [periods, setPeriods] = useState<CompetitionPeriod[]>([]);
    const [loading, setLoading] = useState(true);

    // League param for multi-tenant support
    const { appendLeagueParam, isReady: leagueParamReady } = useLeagueParam();

    // Fetch competition periods on mount (wait for league param to be ready)
    useEffect(() => {
        if (!leagueParamReady) return;

        async function fetchPeriods() {
            try {
                const response = await fetch(appendLeagueParam('/api/competition-periods'));
                if (!response.ok) throw new Error('Failed to fetch periods');
                const data = await response.json();
                setPeriods(data.periods || []);
            } catch (error) {
                console.error('Error fetching competition periods:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchPeriods();
    }, [leagueParamReady, appendLeagueParam]);

    const createDate = (year: number, month: number, day: number) => {
        return new Date(year, month, day);
    };

    const generateDateRanges = (): DateRangeOption[] => {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();

        const ranges: DateRangeOption[] = [
            {
                label: 'All Time',
                value: 'all-time',
                startDate: null,
                endDate: null
            },
            {
                label: `Current Month (${currentDate.toLocaleString('default', { month: 'long' })})`,
                value: 'current-month',
                startDate: createDate(currentYear, currentMonth, 1),
                endDate: createDate(currentYear, currentMonth + 1, 0)
            }
        ];

        // Add quarterly periods from competition_periods (limit to recent 6)
        const quarterlyPeriods = periods
            .filter(p => p.period_type === 'quarterly')
            .slice(0, 6);

        quarterlyPeriods.forEach(period => {
            ranges.push({
                label: period.name,
                value: `period-${period.id}`,
                startDate: new Date(period.start_date),
                endDate: new Date(period.end_date)
            });
        });

        // Add monthly periods (limit to recent 6)
        const monthlyPeriods = periods
            .filter(p => p.period_type === 'monthly')
            .slice(0, 6);

        if (monthlyPeriods.length > 0) {
            monthlyPeriods.forEach(period => {
                ranges.push({
                    label: period.name,
                    value: `period-${period.id}`,
                    startDate: new Date(period.start_date),
                    endDate: new Date(period.end_date)
                });
            });
        }

        return ranges;
    };

    const ranges = generateDateRanges();

    return (
        <div className="mb-6">
            <label className="text-sm font-medium text-white-700">Date Range:</label>
            <select
                className="text-black mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={selectedRange}
                onChange={(e) => {
                    const range = ranges.find(r => r.value === e.target.value);
                    if (range) {
                        onRangeChange(range.startDate, range.endDate, range.value);
                    }
                }}
                disabled={loading}
            >
                {loading ? (
                    <option>Loading...</option>
                ) : (
                    <>
                        <optgroup label="General">
                            {ranges.filter(r => r.value === 'all-time' || r.value === 'current-month').map((range) => (
                                <option key={range.value} value={range.value}>
                                    {range.label}
                                </option>
                            ))}
                        </optgroup>
                        <optgroup label="Quarterly">
                            {ranges.filter(r => r.value.startsWith('period-') && periods.find(p => `period-${p.id}` === r.value)?.period_type === 'quarterly').map((range) => (
                                <option key={range.value} value={range.value}>
                                    {range.label}
                                </option>
                            ))}
                        </optgroup>
                        <optgroup label="Monthly">
                            {ranges.filter(r => r.value.startsWith('period-') && periods.find(p => `period-${p.id}` === r.value)?.period_type === 'monthly').map((range) => (
                                <option key={range.value} value={range.value}>
                                    {range.label}
                                </option>
                            ))}
                        </optgroup>
                    </>
                )}
            </select>
        </div>
    );
}