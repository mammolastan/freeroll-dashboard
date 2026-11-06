// components/ui/ExpandableList.tsx
"use client";

import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandableListProps<T> {
    items: T[];
    renderItem: (item: T, index: number) => ReactNode;
    maxItems?: number;
    expandText?: string;
    collapseText?: string;
}

export function ExpandableList<T>({
    items,
    renderItem,
    maxItems = 10,
    expandText = "Show more",
    collapseText = "Show less"
}: ExpandableListProps<T>) {
    const [isExpanded, setIsExpanded] = useState(false);

    const shouldShowExpandButton = items.length > maxItems;
    const displayedItems = isExpanded ? items : items.slice(0, maxItems);
    const remainingCount = items.length - maxItems;

    return (
        <div className="space-y-3">
            {displayedItems.map((item, index) => (
                <div key={index}>
                    {renderItem(item, index)}
                </div>
            ))}

            {shouldShowExpandButton && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors w-full justify-center pt-2"
                >
                    {isExpanded ? (
                        <>
                            <ChevronUp size={16} />
                            {collapseText}
                        </>
                    ) : (
                        <>
                            <ChevronDown size={16} />
                            {expandText} ({remainingCount} more)
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
