// app/admin/page.tsx
'use client'

import './style-admin.css'
import UpdateNickname from './UpdateNickname'
import ReadProcessedFiles from './ReadProcessedFiles'
import UpdateGameData from './UpdateGameData'
import RecentBadgesAwarded from './RecentBadgesAwarded'

export default function AdminDashboard() {
    // Authentication is now handled by middleware - if we reach this page, user is an admin

    return (
        <div className="admin">
            <h1 className="">Admin Dashboard</h1>

            <hr />
            <h2> Update Player Nickname</h2>
            <UpdateNickname />
            <hr />
            <h2>Processed Files</h2>
            <ReadProcessedFiles />
            <hr />
            <h2>
                Update Games Data
            </h2>
            <UpdateGameData />
            <hr />
            <h2>
                Recent Badges Awarded
            </h2>
            <RecentBadgesAwarded />
        </div>
    )
}
