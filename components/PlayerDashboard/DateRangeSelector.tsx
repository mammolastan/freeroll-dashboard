import React from 'react';

interface DateRangeOption {
    label: string;
    value: string;
    startDate: Date | null;
    endDate: Date | null;
}

interface DateRangeSelectorProps {
    onRangeChange: (startDate: Date | null, endDate: Date | null, value: string) => void;
    selectedRange: string;
}

export function DateRangeSelector({ onRangeChange, selectedRange }: DateRangeSelectorProps) {
    const createDate = (year: number, month: number, day: number) => {
        // Use local date creation to avoid timezone shifts
        return new Date(year, month, day);
    };

    const getCurrentQuarter = (date: Date): number => {
        return Math.floor(date.getMonth() / 3) + 1;
    };

    const generateDateRanges = (): DateRangeOption[] => {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        const currentQuarter = getCurrentQuarter(currentDate);

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
            },
            {
                label: `Current Quarter (Q${currentQuarter} ${currentYear})`,
                value: `Q${currentQuarter}-${currentYear}`,
                startDate: createDate(currentYear, (currentQuarter - 1) * 3, 1),
                endDate: createDate(currentYear, currentQuarter * 3, 0)
            }
        ];

        // Add previous quarters (up to 3)
        let currentQYear = currentYear;
        let remainingQuarters = 3;

        for (let q = currentQuarter - 1; q >= 1 && remainingQuarters > 0; q--) {
            ranges.push({
                label: `Q${q} ${currentQYear}`,
                value: `Q${q}-${currentQYear}`,
                startDate: createDate(currentQYear, (q - 1) * 3, 1),
                endDate: createDate(currentQYear, q * 3, 0)
            });
            remainingQuarters--;
        }

        // If we haven't added 3 quarters yet, move to previous year
        if (remainingQuarters > 0) {
            currentQYear--;
            for (let q = 4; q >= 1 && remainingQuarters > 0; q--) {
                ranges.push({
                    label: `Q${q} ${currentQYear}`,
                    value: `Q${q}-${currentQYear}`,
                    startDate: createDate(currentQYear, (q - 1) * 3, 1),
                    endDate: createDate(currentQYear, q * 3, 0)
                });
                remainingQuarters--;
            }
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
            >
                {ranges.map((range) => (
                    <option key={range.value} value={range.value}>
                        {range.label}
                    </option>
                ))}
            </select>
        </div>
    );
}