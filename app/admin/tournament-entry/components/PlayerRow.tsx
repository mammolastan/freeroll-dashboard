// app/admin/tournament-entry/components/PlayerRow.tsx

'use client';

import React from 'react';
import { X } from 'lucide-react';

interface Player {
    id: number;
    player_name: string;
    player_uid: string | null;
    is_new_player: boolean;
    hitman_name: string | null;
    ko_position: number | null;
    placement: number | null;
    added_by?: 'admin' | 'self_checkin';
    checked_in_at?: string;
    player_nickname?: string | null;
}

interface PlayerRowProps {
    player: Player;
    isIntegrated: boolean;
    hitmanSearchValue: string;
    hitmanDropdownVisible: boolean;
    hitmanHighlightedIndex: number;
    hitmanCandidates: Player[];
    onHitmanSearchChange: (value: string) => void;
    onHitmanFocus: () => void;
    onHitmanBlur: () => void;
    onHitmanKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onHitmanSelect: (hitmanName: string) => void;
    onCrosshairClick: () => void;
    onKOPositionChange: (koPosition: number | null) => void;
    onKOInputFocus: () => void;
    onKOInputBlur: () => void;
    onRemove: () => void;
    renderPlayerIndicator: (player: Player) => React.ReactNode;
}

export function PlayerRow({
    player,
    isIntegrated,
    hitmanSearchValue,
    hitmanDropdownVisible,
    hitmanHighlightedIndex,
    hitmanCandidates,
    onHitmanSearchChange,
    onHitmanFocus,
    onHitmanBlur,
    onHitmanKeyDown,
    onHitmanSelect,
    onCrosshairClick,
    onKOPositionChange,
    onKOInputFocus,
    onKOInputBlur,
    onRemove,
    renderPlayerIndicator
}: PlayerRowProps) {
    const unknownOption = hitmanSearchValue && hitmanSearchValue.toLowerCase().includes('unknown');
    const allOptions = [...hitmanCandidates];
    if (unknownOption) {
        allOptions.push({ id: -1, player_name: 'unknown' } as any);
    }

    return (
        <div
            className={`grid grid-cols-1 md:grid-cols-[3fr,1fr,2fr,1fr,1fr] gap-2 p-3 border-b ${
                player.hitman_name && player.ko_position !== null
                    ? 'bg-red-50 border-red-100'
                    : 'bg-white'
            }`}
        >
            {/* Player Name Column */}
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1">
                    <span className="font-medium text-gray-900">
                        {player.player_name} {player.player_nickname ? `(${player.player_nickname})` : ''}
                    </span>
                    {renderPlayerIndicator(player)}
                    {player.is_new_player && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                            NEW
                        </span>
                    )}
                </div>
            </div>

            {/* Check-in time Column */}
            <div>
                <div>
                    <p className='text-black text-sm'>
                        {player.checked_in_at ? new Date(player.checked_in_at).toLocaleTimeString() : ''}
                    </p>
                </div>
            </div>

            {/* Hitman Input Column */}
            <div className="relative flex">
                {/* Knockout/Clear Button */}
                {!isIntegrated && (
                    <button
                        onClick={onCrosshairClick}
                        className={`ml-2 p-1 rounded-full transition-colors ${
                            player.hitman_name && player.ko_position !== null
                                ? 'text-green-600 hover:text-green-800 hover:bg-green-50'
                                : 'text-red-600 hover:text-red-800 hover:bg-red-50'
                        }`}
                        title={
                            player.hitman_name && player.ko_position !== null
                                ? `Clear knockout data for ${player.player_name} (Hitman: ${player.hitman_name}, KO#: ${player.ko_position})`
                                : `Knockout ${player.player_name}`
                        }
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="0" x2="12" y2="8" />
                            <line x1="12" y1="16" x2="12" y2="24" />
                            <line x1="0" y1="12" x2="8" y2="12" />
                            <line x1="16" y1="12" x2="24" y2="12" />
                            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                        </svg>
                    </button>
                )}
                <input
                    id={`hitman-input-${player.id}`}
                    type="text"
                    value={hitmanSearchValue}
                    onChange={(e) => onHitmanSearchChange(e.target.value)}
                    onFocus={onHitmanFocus}
                    onBlur={onHitmanBlur}
                    onKeyDown={onHitmanKeyDown}
                    className={`w-full px-2 py-1 border rounded text-black text-sm ${
                        isIntegrated ? 'bg-gray-100' : ''
                    }`}
                    placeholder="Enter hitman name or leave as 'unknown'"
                    disabled={isIntegrated}
                />

                {/* Hitman dropdown */}
                {hitmanDropdownVisible && !isIntegrated && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b-md shadow-lg z-10 max-h-32 overflow-y-auto">
                        {hitmanCandidates.map((candidate, index) => (
                            <div
                                key={candidate.id}
                                onClick={() => onHitmanSelect(candidate.player_name)}
                                className={`px-2 py-1 cursor-pointer text-black text-sm ${
                                    index === hitmanHighlightedIndex
                                        ? 'bg-blue-200 text-blue-900'
                                        : 'hover:bg-blue-100'
                                }`}
                            >
                                {candidate.player_name}
                            </div>
                        ))}
                        {/* Add "unknown" option if user is typing */}
                        {unknownOption && (
                            <div
                                onClick={() => onHitmanSelect('unknown')}
                                className={`px-2 py-1 cursor-pointer text-black text-sm border-t ${
                                    hitmanCandidates.length === hitmanHighlightedIndex
                                        ? 'bg-blue-200 text-blue-900'
                                        : 'hover:bg-blue-100'
                                }`}
                            >
                                <em>unknown hitman</em>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* KO Position Column */}
            <div>
                <input
                    type="number"
                    value={player.ko_position || ''}
                    onChange={(e) => onKOPositionChange(parseInt(e.target.value) || null)}
                    onFocus={onKOInputFocus}
                    onBlur={onKOInputBlur}
                    className="w-full px-2 py-1 border rounded text-black text-sm"
                    placeholder="KO #"
                    min={0}
                    disabled={isIntegrated}
                />
            </div>

            {/* Remove Button Column */}
            <div className="flex justify-end">
                {!isIntegrated && (
                    <button
                        onClick={onRemove}
                        className="text-red-600 hover:text-red-800 p-1"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
        </div>
    );
}
