// app/admin/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import './style-admin.css'
import UpdateNickname from './UpdateNickname'
import ReadProcessedFiles from './ReadProcessedFiles'

export default function AdminDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [password, setPassword] = useState('')


    const handleLogin = async () => {
        console.log("Logging in with password:", password)
        const response = await fetch('/api/admin/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        })
        const data = await response.json()
        setIsAuthenticated(data.authenticated)
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="w-96">
                    <CardHeader>
                        <CardTitle>Admin Login</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border rounded text-black"
                            placeholder="Enter password"
                        />
                        <button
                            onClick={handleLogin}
                            className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded"
                        >
                            Login
                        </button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="">
            <h1 className="">Admin Dashboard</h1>

            <hr />
            <h2> Update Player Nickname</h2>
            <UpdateNickname />
            <hr />
            <h2>Processed Files</h2>
            <ReadProcessedFiles />

        </div>
    )
}