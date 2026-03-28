// app/players/page.tsx

'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { PlayerSearch } from '@/components/PlayerDashboard/PlayerSearch'
import { PlayerDetails } from '@/components/PlayerDashboard/PlayerDetails'
import { PlayerAvatarModal } from '@/components/ui/PlayerAvatarModal'
import { getLeagueParamFromURL } from '@/lib/useLeagueParam'
import { FEATURES } from '@/lib/features'
import {
    PlayerReviewModal,
    ReviewCard,
    usePlayerReviews
} from '@/features/player-reviews'

interface Player {
    Name: string
    UID: string
    nickname: string | null
    photo_url?: string | null
    favorite_hand?: string | null
    favorite_pro?: string | null
}

export default function PlayersPage() {
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [initialRange, setInitialRange] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);

    // Session for checking admin status
    const { data: session } = useSession();
    const viewer = session?.user;
    const viewerUid = viewer?.uid ?? null;
    const isAdmin = viewer?.isAdmin === true;

    // Player reviews hook
    const { data: reviewData, deleteReview } = usePlayerReviews(
        FEATURES.PLAYER_REVIEWS && selectedPlayer ? selectedPlayer.UID : null
    );

    // Single useEffect to handle initialization
    useEffect(() => {
        setIsClient(true);

        const urlParams = new URLSearchParams(window.location.search);
        const urlUid = urlParams.get('uid');
        const urlName = urlParams.get('name');
        const urlRange = urlParams.get('range');

        // Set range from URL or localStorage
        if (urlRange) {
            setInitialRange(urlRange);
            localStorage.setItem('selectedRange', urlRange);
        } else {
            const savedRange = localStorage.getItem('selectedRange');
            if (savedRange) {
                setInitialRange(savedRange);
            }
        }

        // Get league param helper for multi-tenant support
        const { appendLeagueParam } = getLeagueParamFromURL();

        // If URL has UID, fetch player data using the stats endpoint
        if (urlUid) {

            // First fetch will get minimal player info
            fetch(appendLeagueParam(`/api/players/search?q=${encodeURIComponent(urlUid)}`))
                .then(response => response.json())
                .then(data => {

                    if (data && data.length > 0) {
                        const playerData = {
                            Name: data[0].Name,
                            UID: data[0].UID,
                            nickname: data[0].nickname || null,
                            photo_url: data[0].photo_url || null,
                            favorite_hand: data[0].favorite_hand || null,
                            favorite_pro: data[0].favorite_pro || null
                        };
                        setSelectedPlayer(playerData);
                        localStorage.setItem('selectedPlayer', JSON.stringify(playerData));
                    }
                })
                .catch(error => console.error('Error fetching player:', error));
        } else if (urlName) {
            // Handle name-based search
            fetch(appendLeagueParam(`/api/players/search?q=${encodeURIComponent(urlName)}&name=true`))
                .then(response => response.json())
                .then(data => {
                    if (data && data.length > 0) {
                        const playerData = {
                            Name: data[0].Name,
                            UID: data[0].UID,
                            nickname: data[0].nickname || null,
                            photo_url: data[0].photo_url || null,
                            favorite_hand: data[0].favorite_hand || null,
                            favorite_pro: data[0].favorite_pro || null
                        };
                        setSelectedPlayer(playerData);
                        localStorage.setItem('selectedPlayer', JSON.stringify(playerData));

                        // Update URL with UID
                        const url = new URL(window.location.href);
                        url.searchParams.delete('name');
                        url.searchParams.set('uid', playerData.UID);
                        window.history.replaceState({}, '', url.toString());
                    }
                })
                .catch(error => console.error('Error fetching player:', error));
        }
    }, []);

    const handlePlayerSelect = (player: Player) => {
        setSelectedPlayer(player);
        localStorage.setItem('selectedPlayer', JSON.stringify(player));

        // Update URL with UID
        const url = new URL(window.location.href);
        url.searchParams.set('uid', player.UID);
        window.history.replaceState({}, '', url.toString());
    };

    if (!isClient) {
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-8">Player Statistics</h1>
                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4">Search Player</h2>
                    <PlayerSearch onPlayerSelect={handlePlayerSelect} />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">Player Statistics</h1>

            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Search Player</h2>
                <PlayerSearch onPlayerSelect={handlePlayerSelect} />
            </div>

            {selectedPlayer && (
                <>
                    {/* Player Profile Header */}
                    <div className="flex items-center gap-6 mb-8 rounded-xl shadow-md p-6 lg:justify-center">
                        {selectedPlayer.photo_url ? (
                            <img
                                src={selectedPlayer.photo_url}
                                alt={selectedPlayer.nickname || selectedPlayer.Name}
                                className="w-24 h-24 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => setIsModalOpen(true)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setIsModalOpen(true);
                                    }
                                }}
                            />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-gray-300 flex items-center justify-center ">
                                <span className="text-3xl font-bold text-white">
                                    {(selectedPlayer.nickname || selectedPlayer.Name).charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                                {selectedPlayer.nickname || selectedPlayer.Name}
                            </h2>
                            {selectedPlayer.nickname && (
                                <p className="text-gray-600 dark:text-white text-sm mt-1">
                                    {selectedPlayer.Name}
                                </p>
                            )}
                            {(selectedPlayer.favorite_hand || selectedPlayer.favorite_pro) && (
                                <div className="mt-3 text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                    {selectedPlayer.favorite_hand && (
                                        <p><span className="text-gray-500 dark:text-gray-400">Favorite Hand:</span> {selectedPlayer.favorite_hand}</p>
                                    )}
                                    {selectedPlayer.favorite_pro && (
                                        <p><span className="text-gray-500 dark:text-gray-400">Favorite Pro:</span> {selectedPlayer.favorite_pro}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Community Reviews Section - above stats/badges */}
                    {FEATURES.PLAYER_REVIEWS && (
                        <section className="mb-8 bg-gray-900 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-white">Community Reviews</h2>
                                <button
                                    onClick={() => setShowReviewModal(true)}
                                    className="text-sm text-yellow-400 hover:underline"
                                >
                                    {reviewData?.my_review ? 'Edit My Review' : 'Leave a Review'}
                                </button>
                            </div>
                            {/* Simple average display without distribution bars */}
                            {reviewData && reviewData.summary.total_reviews > 0 && (
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-2xl font-bold text-white">{reviewData.summary.average_rating.toFixed(1)}</span>
                                    <span className="text-yellow-400 text-xl">★</span>
                                    <span className="text-sm text-gray-400">({reviewData.summary.total_reviews} review{reviewData.summary.total_reviews !== 1 ? 's' : ''})</span>
                                </div>
                            )}
                            {reviewData && reviewData.summary.total_reviews === 0 && (
                                <p className="text-sm text-gray-400 italic mb-4">No reviews yet. Be the first!</p>
                            )}
                            {reviewData?.reviews && reviewData.reviews.length > 0 && (
                                <div className="space-y-3 mt-4">
                                    {reviewData.reviews.slice(0, 5).map((r) => (
                                        <ReviewCard
                                            key={r.id}
                                            review={r}
                                            canDelete={isAdmin || viewerUid === r.reviewer_uid}
                                            onDelete={deleteReview}
                                        />
                                    ))}
                                    {reviewData.reviews.length > 5 && (
                                        <button
                                            onClick={() => setShowReviewModal(true)}
                                            className="text-sm text-yellow-400 hover:underline"
                                        >
                                            View all {reviewData.reviews.length} reviews
                                        </button>
                                    )}
                                </div>
                            )}
                            <PlayerReviewModal
                                isOpen={showReviewModal}
                                onClose={() => setShowReviewModal(false)}
                                reviewed_uid={selectedPlayer.UID}
                                player_name={selectedPlayer.nickname || selectedPlayer.Name}
                            />
                        </section>
                    )}

                    <PlayerDetails
                        key={`${selectedPlayer.UID}-${initialRange}`}
                        playerUID={selectedPlayer.UID}
                        playerName={selectedPlayer.nickname || selectedPlayer.Name}
                        initialRange={initialRange}
                    />

                    {/* Avatar Modal */}
                    {selectedPlayer.photo_url && (
                        <PlayerAvatarModal
                            photoUrl={selectedPlayer.photo_url}
                            name={selectedPlayer.nickname || selectedPlayer.Name}
                            uid={selectedPlayer.UID}
                            isOpen={isModalOpen}
                            onClose={() => setIsModalOpen(false)}
                        />
                    )}
                </>
            )}
        </div>
    );
}