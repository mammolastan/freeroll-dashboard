// app/admin/tournament-entry/components/TournamentValidationStatus.tsx

'use client';

import React from 'react';
import { Trophy } from 'lucide-react';
import {
    validateTournamentForIntegration,
    previewPlacements,
    hasAutoFixableKOIssues,
    type Player
} from '@/lib/tournamentValidation';

interface TournamentValidationStatusProps {
    players: Player[];
    isIntegrated: boolean;
    isIntegrating: boolean;
    onIntegrate: () => void;
    onAutoCalculateKOPositions: () => void;
}

export function TournamentValidationStatus({
    players,
    isIntegrated,
    isIntegrating,
    onIntegrate,
    onAutoCalculateKOPositions
}: TournamentValidationStatusProps) {
    const validation = validateTournamentForIntegration(players);
    const placementPreview = validation.canIntegrate ? previewPlacements(players) : [];
    const hasKOPositionIssues = hasAutoFixableKOIssues(validation, players);

    return (
        <div className="mb-6 p-4 border rounded-lg">
            <h3 className="font-semibold text-lg mb-3">Integration Status</h3>

            <div className={`p-3 rounded-lg mb-4 ${
                validation.canIntegrate ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
                <div className={`font-medium ${
                    validation.canIntegrate ? 'text-green-800' : 'text-red-800'
                }`}>
                    {validation.validationMessage}
                </div>

                {/* Auto-calculate button for KO position issues */}
                {!validation.canIntegrate && hasKOPositionIssues && (
                    <button
                        onClick={onAutoCalculateKOPositions}
                        disabled={isIntegrated}
                        className="mt-3 mr-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center gap-2"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        Auto-Calculate KO #s
                    </button>
                )}

                {validation.canIntegrate && (
                    <button
                        onClick={onIntegrate}
                        disabled={isIntegrating || isIntegrated}
                        className="mt-3 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center gap-2"
                    >
                        <Trophy className="h-4 w-4" />
                        {isIntegrating ? 'Integrating...' : 'Integrate Tournament'}
                    </button>
                )}

                {!validation.canIntegrate && (
                    <div className="mt-2 text-sm text-red-700">
                        <ul className="list-disc list-inside space-y-1">
                            {validation.errors.map((error, index) => (
                                <li key={index}>{error}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {validation.canIntegrate && placementPreview.length > 0 && (
                <div className="bg-blue-50 border-blue-200 text-black rounded-lg p-3">
                    <h4 className="font-medium text-blue-800 mb-2">Final Placement Preview:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                        {placementPreview.map((player, index) => (
                            <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                                <span className="font-medium">
                                    {player.name}
                                </span>
                                <div className="text-right text-xs text-gray-600">
                                    <div>Place: {player.finalPlacement}</div>
                                    {player.koPosition && <div>KO #{player.koPosition}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
