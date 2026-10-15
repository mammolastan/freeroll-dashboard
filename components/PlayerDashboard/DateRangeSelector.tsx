// components/PlayerDashboard/DateRangeSelector.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
    /** When true, shows ALL historical periods with year/period selection */
    showAllPeriods?: boolean;
    /** Optional: filter periods to only those where this player has games */
    playerUid?: string;
}

export function DateRangeSelector({ onRangeChange, selectedRange, showAllPeriods = false, playerUid }: DateRangeSelectorProps) {
    const [periods, setPeriods] = useState<CompetitionPeriod[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState<string>("all");

    // League param for multi-tenant support
    const { appendLeagueParam, isReady: leagueParamReady } = useLeagueParam();

    // Fetch competition periods on mount (wait for league param to be ready)
    useEffect(() => {
        if (!leagueParamReady) return;

        async function fetchPeriods() {
            try {
                // Build query params
                const params = new URLSearchParams();
                if (showAllPeriods) {
                    params.set('active_only', 'false');
                }
                if (playerUid) {
                    params.set('playerUid', playerUid);
                }
                const queryString = params.toString();
                const endpoint = `/api/competition-periods${queryString ? `?${queryString}` : ''}`;
                const response = await fetch(appendLeagueParam(endpoint));
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
    }, [leagueParamReady, appendLeagueParam, showAllPeriods, playerUid]);

    // Helper to extract year from date string without timezone issues
    const getYearFromDateString = (dateStr: string): number => {
        // Handle ISO format "2024-01-01T00:00:00.000Z" or "2024-01-01"
        return parseInt(dateStr.substring(0, 4));
    };

    // Extract unique years from periods
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        periods.forEach(period => {
            const year = getYearFromDateString(period.start_date);
            years.add(year);
        });
        return Array.from(years).sort((a, b) => b - a); // Descending order
    }, [periods]);

    // Sync selectedYear with selectedRange when it's "all-time"
    useEffect(() => {
        if (selectedRange === "all-time") {
            setSelectedYear("all");
        }
    }, [selectedRange]);

    // Sync selection when periods load and current selectedRange doesn't match any option
    useEffect(() => {
        if (loading || periods.length === 0) return;

        const ranges = generateDateRanges();
        const currentRangeExists = ranges.some(r => r.value === selectedRange);

        if (!currentRangeExists) {
            // Default to the quarterly period that contains today's date, or first quarterly, or all-time
            const today = new Date();
            const quarterlyRanges = ranges.filter(r =>
                r.value.startsWith('period-') &&
                periods.find(p => `period-${p.id}` === r.value)?.period_type === 'quarterly'
            );

            // Find the period that contains today
            const currentQuarterlyPeriod = quarterlyRanges.find(r =>
                r.startDate && r.endDate &&
                today >= r.startDate && today <= r.endDate
            );

            const defaultRange = currentQuarterlyPeriod || quarterlyRanges[0] || ranges[0];

            if (defaultRange) {
                onRangeChange(defaultRange.startDate, defaultRange.endDate, defaultRange.value);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, periods]); // Intentionally omit selectedRange/onRangeChange to only run once after periods load

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

        // Add quarterly periods from competition_periods
        // Limit to recent 6 unless showAllPeriods is true
        const allQuarterlyPeriods = periods.filter(p => p.period_type === 'quarterly');
        const quarterlyPeriods = showAllPeriods ? allQuarterlyPeriods : allQuarterlyPeriods.slice(0, 6);

        quarterlyPeriods.forEach(period => {
            ranges.push({
                label: period.name,
                value: `period-${period.id}`,
                startDate: new Date(period.start_date),
                endDate: new Date(period.end_date)
            });
        });

        // Add monthly periods
        // Limit to recent 6 unless showAllPeriods is true
        const allMonthlyPeriods = periods.filter(p => p.period_type === 'monthly');
        const monthlyPeriods = showAllPeriods ? allMonthlyPeriods : allMonthlyPeriods.slice(0, 6);

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

    // Get periods filtered by selected year
    const getPeriodsForYear = (year: string) => {
        if (year === "all") return [];
        const yearNum = parseInt(year);
        return periods.filter(period => {
            const periodYear = getYearFromDateString(period.start_date);
            return periodYear === yearNum;
        });
    };

    const ranges = generateDateRanges();
    const periodsForYear = getPeriodsForYear(selectedYear);
    const quarterlyForYear = periodsForYear.filter(p => p.period_type === 'quarterly');
    const monthlyForYear = periodsForYear.filter(p => p.period_type === 'monthly');

    const handleYearChange = (year: string) => {
        setSelectedYear(year);
        if (year === "all") {
            // Select "All Time" when switching to "all"
            onRangeChange(null, null, "all-time");
        } else {
            // When changing year, auto-select the first quarterly period for that year if available
            const yearPeriods = getPeriodsForYear(year);
            const firstQuarterly = yearPeriods.find(p => p.period_type === 'quarterly');
            if (firstQuarterly) {
                onRangeChange(
                    new Date(firstQuarterly.start_date),
                    new Date(firstQuarterly.end_date),
                    `period-${firstQuarterly.id}`
                );
            } else if (yearPeriods.length > 0) {
                const firstPeriod = yearPeriods[0];
                onRangeChange(
                    new Date(firstPeriod.start_date),
                    new Date(firstPeriod.end_date),
                    `period-${firstPeriod.id}`
                );
            }
        }
    };

    const handlePeriodChange = (periodValue: string) => {
        if (periodValue === "all-time") {
            onRangeChange(null, null, "all-time");
            return;
        }
        if (periodValue === "current-month") {
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth();
            onRangeChange(
                createDate(currentYear, currentMonth, 1),
                createDate(currentYear, currentMonth + 1, 0),
                "current-month"
            );
            return;
        }
        const period = periods.find(p => `period-${p.id}` === periodValue);
        if (period) {
            onRangeChange(
                new Date(period.start_date),
                new Date(period.end_date),
                periodValue
            );
        }
    };

    // For showAllPeriods mode, render year + period dropdowns
    if (showAllPeriods) {
        return (
            <div className="mb-6">
                <label className="text-sm font-medium text-white-700">Date Range:</label>
                <div className="flex gap-2 mt-1">
                    {/* Year Selector */}
                    <select
                        className="text-black px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        value={selectedYear}
                        onChange={(e) => handleYearChange(e.target.value)}
                        disabled={loading}
                    >
                        {loading ? (
                            <option>Loading...</option>
                        ) : (
                            <>
                                <option value="all">All Time</option>
                                {availableYears.map(year => (
                                    <option key={year} value={year.toString()}>
                                        {year}
                                    </option>
                                ))}
                            </>
                        )}
                    </select>

                    {/* Period Selector - only show if a specific year is selected */}
                    {selectedYear !== "all" && (
                        <select
                            className="text-black flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            value={selectedRange}
                            onChange={(e) => handlePeriodChange(e.target.value)}
                            disabled={loading}
                        >
                            {quarterlyForYear.length > 0 && (
                                <optgroup label="Quarterly">
                                    {quarterlyForYear.map(period => (
                                        <option key={period.id} value={`period-${period.id}`}>
                                            {period.name}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                            {monthlyForYear.length > 0 && (
                                <optgroup label="Monthly">
                                    {monthlyForYear.map(period => (
                                        <option key={period.id} value={`period-${period.id}`}>
                                            {period.name}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    )}
                </div>
            </div>
        );
    }

    // Default single dropdown for non-showAllPeriods mode
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
