// lib/tournamentValidation.ts
// Tournament validation and placement calculation utilities

export interface Player {
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

export interface ValidationResult {
    canIntegrate: boolean;
    validationMessage: string;
    errors: string[];
}

export interface PlacementPreview {
    name: string;
    koPosition: number | null;
    finalPlacement: number;
    hitman: string | null;
}

/**
 * Validates tournament data before integration
 */
export function validateTournamentForIntegration(players: Player[]): ValidationResult {
    const errors: string[] = [];

    // Check minimum players
    if (players.length < 2) {
        errors.push("Tournament must have at least 2 players");
    }

    // Check that all players have either a KO position or are the survivor
    const playersWithKoPosition = players.filter(p => p.ko_position !== null);
    const survivorPlayers = players.filter(p => p.ko_position === null);

    // Must have exactly one survivor (winner)
    if (survivorPlayers.length === 0) {
        errors.push("Tournament must have exactly 1 winner (player with no KO position)");
    } else if (survivorPlayers.length > 1) {
        const survivorNames = survivorPlayers.map(p => p.player_name).join(", ");
        errors.push(`Only 1 player can be the winner (no KO position). Found ${survivorPlayers.length}: ${survivorNames}`);
    }

    // All other players must have KO positions
    if (playersWithKoPosition.length !== players.length - 1) {
        const missingKO = players.filter(p => p.ko_position === null && survivorPlayers.length > 0 && !survivorPlayers.includes(p));
        if (missingKO.length > 0) {
            errors.push(`Players missing KO positions: ${missingKO.map(p => p.player_name).join(", ")}`);
        }
    }

    // KO positions must be sequential starting from 1
    if (playersWithKoPosition.length > 0) {
        const koPositions = playersWithKoPosition.map(p => p.ko_position!).sort((a, b) => a - b);
        const expectedPositions = Array.from({ length: koPositions.length }, (_, i) => i + 1);

        const missingPositions = expectedPositions.filter(pos => !koPositions.includes(pos));
        if (missingPositions.length > 0) {
            errors.push(`Missing KO positions: ${missingPositions.join(", ")}. Must be sequential from 1 to ${koPositions.length}`);
        }
    }

    // Check for duplicate KO positions
    const koPositionCounts = new Map<number, string[]>();
    playersWithKoPosition.forEach(p => {
        const playersList = koPositionCounts.get(p.ko_position!) || [];
        playersList.push(p.player_name);
        koPositionCounts.set(p.ko_position!, playersList);
    });

    for (const [position, playerNames] of koPositionCounts) {
        if (playerNames.length > 1) {
            errors.push(`Duplicate KO position ${position}: ${playerNames.join(", ")}`);
        }
    }

    // Check that players with hitman have KO positions
    const playersWithHitmanButNoKO = players.filter(p =>
        p.hitman_name !== null &&
        p.hitman_name !== '' &&
        p.ko_position === null
    );
    if (playersWithHitmanButNoKO.length > 0) {
        errors.push(`Players with hitman must have KO positions: ${playersWithHitmanButNoKO.map(p => p.player_name).join(", ")}`);
    }

    const isValid = errors.length === 0;

    return {
        canIntegrate: isValid,
        validationMessage: isValid
            ? `✅ Tournament ready for integration with ${players.length} players`
            : `❌ Cannot integrate tournament`,
        errors
    };
}

/**
 * Preview what placements will be calculated for each player
 */
export function previewPlacements(players: Player[]): PlacementPreview[] {
    const knockedOutPlayers = players.filter(p => p.ko_position !== null);

    return players.map(player => {
        let finalPlacement: number;

        if (player.ko_position === null) {
            // Survivor = Winner = 1st place
            finalPlacement = 1;
        } else {
            // Convert KO position to final placement
            // Highest KO position = 2nd place
            // 2nd highest KO position = 3rd place, etc.
            finalPlacement = (knockedOutPlayers.length - player.ko_position) + 2;
        }

        return {
            name: player.player_name,
            koPosition: player.ko_position,
            finalPlacement,
            hitman: player.hitman_name
        };
    }).sort((a, b) => a.finalPlacement - b.finalPlacement);
}

/**
 * Check if validation errors include KO position issues that can be auto-fixed
 */
export function hasAutoFixableKOIssues(validation: ValidationResult, players: Player[]): boolean {
    const playersWithKO = players.filter(p => p.ko_position !== null);
    return validation.errors.some(error =>
        error.includes('Duplicate KO position') ||
        error.includes('Must be sequential from 1 to')
    ) && playersWithKO.length > 0;
}

/**
 * Export tournament data as text
 */
export function exportTournamentAsText(
    tournament: { venue: string; tournament_date: string; director_name: string; start_points: number },
    players: Player[]
): void {
    if (players.length === 0) return;

    const sortedPlayers = [...players].sort((a, b) => {
        if (a.ko_position !== null && b.ko_position !== null) {
            return a.ko_position - b.ko_position;
        }
        if (a.ko_position !== null) return -1;
        if (b.ko_position !== null) return 1;
        return a.player_name.localeCompare(b.player_name);
    });

    let output = `Tournament: ${tournament.venue} - ${tournament.tournament_date}\n`;
    output += `Director: ${tournament.director_name}\n`;
    output += `Players: ${players.length}\n`;
    output += `Start Points: ${tournament.start_points}\n\n`;

    sortedPlayers.forEach(player => {
        output += `Player: ${player.player_name}`;
        if (player.is_new_player) output += ' (NEW)';
        if (player.hitman_name) output += ` | Hitman: ${player.hitman_name}`;
        if (player.ko_position !== null) {
            output += ` | KO Position: ${player.ko_position}`;
            // Calculate dynamic placement based on total players and ko_position
            const dynamicPlacement = players.length - player.ko_position + 1;
            output += ` | Final Position: ${dynamicPlacement}`;
        }
        output += '\n';
    });

    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tournament_${tournament.venue.replace(/\s+/g, '_')}_${tournament.tournament_date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
