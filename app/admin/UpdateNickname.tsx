'use client'

import React from 'react'
import { useState, useEffect } from 'react'

interface Player {
    Name: string
    UID: string
    nickname: string | null
}

export default function UpdateNickname() {
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<Player[]>([])
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
    const [newNickname, setNewNickname] = useState('')
    const [updateStatus, setUpdateStatus] = useState<string>('')
    useEffect(() => {
        console.log("in search query useEffect: ", searchQuery)

        if (!searchQuery) {
            setSearchResults([])
            return
        }

        const searchTimer = setTimeout(async () => {
            try {
                const response = await fetch(`/api/players/search?q=${encodeURIComponent(searchQuery)}&name=true`)
                const data = await response.json()
                setSearchResults(data)
            } catch (error) {
                console.error('Failed to search players:', error)
            }
        }, 300)

        return () => clearTimeout(searchTimer)
    }, [searchQuery])

    const handleUpdateNickname = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedPlayer) return

        try {
            const response = await fetch('/api/admin/players/update-nickname', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: selectedPlayer.UID, nickname: newNickname })
            })

            if (response.ok) {
                setUpdateStatus('Nickname updated successfully')
                setNewNickname('')
                setSelectedPlayer(null)
                setSearchQuery('')
            } else {
                setUpdateStatus('Failed to update nickname')
            }
        } catch {
            setUpdateStatus('Error updating nickname')
        }
    }


    return (
        <>

            <div className="mb-4">
                <label>Search Player</label>
                <br />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className=""
                    placeholder="Enter player name"
                />
                {searchResults.length > 0 && (
                    <div className="">
                        {searchResults.map((player) => (
                            <div
                                key={player.UID}
                                className="clickme"
                                onClick={() => {
                                    setSelectedPlayer(player)
                                    setSearchResults([])
                                    setSearchQuery(player.Name)
                                }}
                            >
                                {player.Name} {player.nickname ? `(${player.nickname})` : ''}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {selectedPlayer && (
                <form onSubmit={handleUpdateNickname} className="space-y-4">
                    <div>
                        <label className="">New Nickname</label>
                        <br />
                        <input
                            type="text"
                            value={newNickname}
                            onChange={(e) => setNewNickname(e.target.value)}
                            className=""
                            placeholder="Enter new nickname"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className=""
                    >
                        Update Nickname
                    </button>
                </form>
            )}
            {updateStatus && (
                <div className={`mt-4 p-2 rounded ${updateStatus.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                    {updateStatus}
                </div>
            )}
        </>
    )
}
