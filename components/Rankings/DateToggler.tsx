// components/Rankings/DateToggler.tsx

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function DateToggler({
    isCurrentPeriod,
    setIsCurrentPeriod,
    currentLabel,
    previousLabel
}: {
    isCurrentPeriod: boolean;
    setIsCurrentPeriod: React.Dispatch<React.SetStateAction<boolean>>;
    currentLabel: string;
    previousLabel: string;
}) {
    return (
        <div className="flex gap-2">
            <button
                onClick={() => setIsCurrentPeriod(false)}
                className={`px-4 py-2 flex items-center gap-2 transition-all duration-300 rounded-lg
          ${!isCurrentPeriod
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 opacity-50 hover:opacity-100'
                    }`}
            >
                <ChevronLeft size={16} className={!isCurrentPeriod ? 'opacity-0' : 'opacity-100'} />
                <span>{previousLabel}</span>
            </button>
            <button
                onClick={() => setIsCurrentPeriod(true)}
                className={`px-4 py-2 flex items-center gap-2 transition-all duration-300 rounded-lg
          ${isCurrentPeriod
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 opacity-50 hover:opacity-100'
                    }`}
            >
                <span>{currentLabel}</span>
                <ChevronRight size={16} className={isCurrentPeriod ? 'opacity-0' : 'opacity-100'} />
            </button>
        </div>
    );
}