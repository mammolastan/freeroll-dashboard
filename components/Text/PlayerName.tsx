//components/PlayerName.tsx 
import { getCachedPlayers, formatPlayerName } from '@/lib/players-cache';

interface PlayerNameProps {
    playerUID: string;
    displayFormat?: 'name' | 'nickname' | 'both';
    fallbackText?: string;
    className?: string;
}

export default async function PlayerName({
    playerUID,
    displayFormat = 'name',
    fallbackText = 'Unknown Player',
    className
}: PlayerNameProps) {
    // This runs on the server and uses the cached data
    const players = await getCachedPlayers();
    const player = players.find(p => p.uid === playerUID);
    const displayName = formatPlayerName(player, displayFormat, fallbackText);

    return (
        <span
            className={className}
            title={`Player UID: ${playerUID}`}
        >
            {displayName}
        </span>
    );
}