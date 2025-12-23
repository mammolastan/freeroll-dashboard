// components/Rankings/QualificationBarrier.tsx

import React from 'react';
import { AlertTriangle, Trophy, X } from 'lucide-react';
import './QualificationBarrier.css';

interface QualificationBarrierProps {
    qualifiedCount: number;
    totalPlayers: number;
}

export function QualificationBarrier({ qualifiedCount, totalPlayers }: QualificationBarrierProps) {
    const nonQualifiedCount = totalPlayers - qualifiedCount;

    return (
        <div className="qualification-barrier-container">
            {/* Animated Caution Tape */}
            <div className="caution-tape">
                <div className="tape-content">
                    <span className="tape-text">QUALIFICATION LINE</span>
                    <AlertTriangle className="tape-icon" size={16} />
                    <span className="tape-text">TOP 40 QUALIFY</span>
                    <AlertTriangle className="tape-icon" size={16} />
                    <span className="tape-text">QUALIFICATION LINE</span>
                    <AlertTriangle className="tape-icon" size={16} />
                    <span className="tape-text">TOP 40 QUALIFY</span>
                    <AlertTriangle className="tape-icon" size={16} />
                    <span className="tape-text">QUALIFICATION LINE</span>
                    <AlertTriangle className="tape-icon" size={16} />
                    <span className="tape-text">TOP 40 QUALIFY</span>
                    <AlertTriangle className="tape-icon" size={16} />
                </div>
            </div>

            {/* Status Cards */}
            <div className="barrier-stats">
                <div className="stat-card qualified">
                    <div className="stat-icon">
                        <Trophy size={20} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-number">{qualifiedCount}</div>
                        <div className="stat-label">Qualified</div>
                    </div>
                </div>




            </div>

            {/* Motivational Message */}
            <div className="barrier-message">
                <p>
                    {nonQualifiedCount > 0 ? (
                        <>
                            <strong>{nonQualifiedCount} players</strong> are short of the quarterly tournament.
                            Keep playing to secure your chance to win a trip to Vegas!
                        </>
                    ) : (
                        <>
                            Looks like this season is just getting started
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}