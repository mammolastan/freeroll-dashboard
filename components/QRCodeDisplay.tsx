// components/QRCodeDisplay.tsx
'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
    value: string;
    size?: number;
    className?: string;
}

export default function QRCodeDisplay({ value, size = 192, className = '' }: QRCodeDisplayProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current && value) {
            QRCode.toCanvas(canvasRef.current, value, {
                width: size,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            }, (error) => {
                if (error) {
                    console.error('QR Code generation error:', error);
                }
            });
        }
    }, [value, size]);

    return (
        <canvas
            ref={canvasRef}
            className={`border border-gray-200 rounded ${className}`}
        />
    );
}

// Update the QRCodeModal in your admin page to use this component
interface QRCodeModalProps {
    showQRCode: boolean;
    setShowQRCode: (show: boolean) => void;
    checkInUrl: string;
    copyCheckInUrl: () => void;
}

const _QRCodeModal = ({ showQRCode, setShowQRCode, checkInUrl, copyCheckInUrl }: QRCodeModalProps) => {
    if (!showQRCode) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Player Check-In</h3>
                    <button
                        onClick={() => setShowQRCode(false)}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="text-center space-y-4">
                    {/* Real QR Code */}
                    <div className="flex justify-center">
                        <QRCodeDisplay
                            value={checkInUrl}
                            size={192}
                            className="mx-auto"
                        />
                    </div>

                    <div>
                        <p className="text-sm text-gray-600 mb-2">
                            Players can scan this QR code or visit:
                        </p>
                        <div className="bg-gray-50 p-2 rounded border text-xs font-mono break-all">
                            {checkInUrl}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={copyCheckInUrl}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                        >
                            Copy Link
                        </button>
                        <button
                            onClick={() => window.open(checkInUrl, '_blank')}
                            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                        >
                            Test Link
                        </button>
                    </div>

                    <div className="text-xs text-gray-500 text-left space-y-1">
                        <p>• Players will enter their name to check in</p>
                        <p>• System will suggest existing players or create new ones</p>
                        <p>• Check-ins will appear automatically with a blue dot indicator</p>
                        <p>• Page refreshes every 15 seconds when active</p>
                    </div>
                </div>
            </div>
        </div>
    );
};