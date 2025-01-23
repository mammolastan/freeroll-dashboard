import React, { useState } from 'react';

interface DateRangePickerProps {
    onRangeChange: (startDate: Date, endDate: Date) => void;
    initialStartDate: Date | null;
    initialEndDate: Date | null;
}

export function DateRangePicker({
    onRangeChange,
    initialStartDate,
    initialEndDate
}: DateRangePickerProps) {
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(new Date());

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            setStartDate(new Date(e.target.value));
        } else {
            setStartDate(null);
        }
    };

    const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            setEndDate(new Date(e.target.value));
        } else {
            setEndDate(null);
        }
    };

    const handleSubmit = () => {
        if (startDate && endDate) {
            onRangeChange(startDate, endDate);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-4">
                <div>
                    <label className="block text-sm font-medium text-white-700">Start Date</label>
                    <input
                        type="date"
                        className="mt-1 text-black block w-full rounded-md border-gray-300 shadow-sm"
                        onChange={handleStartDateChange}

                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-white-700">End Date</label>
                    <input
                        type="date"
                        className="mt-1 text-black block w-full rounded-md border-gray-300 shadow-sm"
                        onChange={handleEndDateChange}
                        defaultValue={today}
                    />
                </div>
            </div>
            <button
                onClick={handleSubmit}
                disabled={!startDate || !endDate}
                className={`px-4 py-2 rounded-md ${!startDate || !endDate
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                    } text-white transition-colors`}
            >
                Update Stats
            </button>
        </div>
    );
}