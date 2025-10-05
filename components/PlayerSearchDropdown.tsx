'use client';

import React from 'react';

export interface PlayerSearchResult {
    Name: string;
    UID: string;
    nickname?: string | null;
    TotalGames?: number;
    TotalPoints?: number;
}

export interface CheckedInPlayer {
    player_uid?: string | null;
    player_name: string;
}

interface PlayerSearchDropdownProps {
    searchResults: PlayerSearchResult[];
    isSearching: boolean;
    checkedInPlayers: CheckedInPlayer[];
    onSelectPlayer: (player: PlayerSearchResult) => void;
    onAddNewPlayer?: (name: string) => void;
    showAddNewOption?: boolean;
    newPlayerName?: string;
}

export function PlayerSearchDropdown({
    searchResults,
    isSearching,
    checkedInPlayers,
    onSelectPlayer,
    onAddNewPlayer,
    showAddNewOption = false,
    newPlayerName = ''
}: PlayerSearchDropdownProps) {
    const isPlayerCheckedIn = (player: PlayerSearchResult): boolean => {
        return checkedInPlayers.some(p => {
            const uidMatch = p.player_uid === player.UID;
            const nameMatch = p.player_name.toLowerCase() === player.Name.toLowerCase();
            const nicknameMatch = player.nickname && p.player_name.toLowerCase() === player.nickname.toLowerCase();
            return uidMatch || nameMatch || nicknameMatch;
        });
    };

    const handlePlayerClick = (player: PlayerSearchResult, isCheckedIn: boolean) => {
        if (isCheckedIn) {
            alert('This player is already checked in to the tournament!');
        } else {
            onSelectPlayer(player);
        }
    };

    return (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
            {isSearching ? (
                <div className="px-3 py-2 text-gray-500">Searching...</div>
            ) : (
                <>
                    {searchResults.map((player) => {
                        const isCheckedIn = isPlayerCheckedIn(player);

                        return (
                            <div
                                key={player.UID}
                                onClick={() => handlePlayerClick(player, isCheckedIn)}
                                className={`px-3 py-2 border-b last:border-b-0 ${
                                    isCheckedIn
                                        ? 'bg-red-100 text-red-600 cursor-not-allowed opacity-75'
                                        : 'hover:bg-blue-50 cursor-pointer'
                                }`}
                            >
                                <div className={`font-medium ${isCheckedIn ? 'line-through' : 'text-gray-900'}`}>
                                    {player.nickname ? `${player.Name} (${player.nickname})` : player.Name}
                                    {isCheckedIn && (
                                        <span className="ml-2 text-xs text-red-600 font-bold">
                                            (ALREADY CHECKED IN)
                                        </span>
                                    )}
                                </div>
                                {(player.TotalGames || player.TotalPoints) && (
                                    <div className="text-sm text-gray-600">
                                        {player.TotalGames || 0} games, {player.TotalPoints || 0} points
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {showAddNewOption && newPlayerName.trim() && onAddNewPlayer && (
                        <div
                            onClick={() => onAddNewPlayer(newPlayerName.trim())}
                            className="px-3 py-2 hover:bg-green-50 cursor-pointer border-t bg-green-25"
                        >
                            <div className="font-medium text-green-700">
                                Add &quot;{newPlayerName.trim()}&quot; as new player
                            </div>
                            <div className="text-sm text-green-600">
                                This will create a new player record
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
