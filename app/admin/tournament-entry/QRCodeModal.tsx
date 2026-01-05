import React, { useEffect, useRef } from 'react'
import QRCode from 'qrcode';
import { Download, X } from 'lucide-react';

type QRCodeModalProps = {
    checkInUrl: string;
    showQRCode: boolean;
    setShowQRCode: (show: boolean) => void;
    currentDraft: {
        tournament_date: string;
        venue: string;
    } | null;
};

export function QRCodeModal({ checkInUrl, showQRCode, setShowQRCode, currentDraft }: QRCodeModalProps) {

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const compositeCanvasRef = useRef<HTMLCanvasElement>(null);

    // Generate QR code and composite image when modal opens
    useEffect(() => {
        const createCompositeQRImage = () => {
            if (!canvasRef.current || !compositeCanvasRef.current || !currentDraft) return;

            const qrCanvas = canvasRef.current;
            const compositeCanvas = compositeCanvasRef.current;
            const ctx = compositeCanvas.getContext('2d');
            if (!ctx) return;

            // Set composite canvas dimensions
            const padding = 40;
            const headerHeight = 40;
            const footerHeight = 0;
            const qrSize = 192;
            const totalWidth = qrSize + (padding * 2);
            const totalHeight = qrSize + headerHeight + footerHeight + (padding * 2);

            compositeCanvas.width = totalWidth;
            compositeCanvas.height = totalHeight;

            // Fill background with white
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, totalWidth, totalHeight);

            // Add border
            ctx.strokeStyle = '#E5E7EB';
            ctx.lineWidth = 2;
            ctx.strokeRect(1, 1, totalWidth - 2, totalHeight - 2);

            // Format tournament date
            const tournamentDate = new Date(currentDraft.tournament_date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Header text - Tournament info
            ctx.fillStyle = '#1F2937';
            ctx.font = 'bold 18px Arial, sans-serif';
            ctx.textAlign = 'center';

            ctx.font = '14px Arial, sans-serif';
            ctx.fillStyle = '#374151';
            ctx.fillText(tournamentDate, totalWidth / 2, padding + 10);
            ctx.fillText(currentDraft.venue, totalWidth / 2, padding + 30);

            // Draw the QR code in the center
            const qrX = (totalWidth - qrSize) / 2;
            const qrY = padding + headerHeight;
            ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);


        };

        if (canvasRef.current && compositeCanvasRef.current && checkInUrl && showQRCode && currentDraft) {
            // First generate the QR code on the hidden canvas
            QRCode.toCanvas(canvasRef.current, checkInUrl, {
                width: 192,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            }, (error) => {
                if (error) {
                    console.error('QR Code generation error:', error);
                    return;
                }

                // create the composite image with tournament info
                createCompositeQRImage();
            });
        }
    }, [checkInUrl, showQRCode, currentDraft]);



    const downloadQRCode = () => {
        if (!compositeCanvasRef.current || !currentDraft) return;

        const link = document.createElement('a');
        const dateString = new Date(currentDraft.tournament_date).toISOString().split('T')[0];
        const venueSlug = currentDraft.venue.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        link.download = `tournament-qr-${dateString}-${venueSlug}.png`;
        link.href = compositeCanvasRef.current.toDataURL('image/png');

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Function to copy check-in URL
    const copyCheckInUrl = () => {
        navigator.clipboard.writeText(checkInUrl);
        alert('Check-in URL copied to clipboard!');
    };

    if (!showQRCode) return null;


    console.log("currentDraft")
    console.log(currentDraft)

    return (

        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowQRCode(false)}>
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg text-black font-semibold">Game viewer</h3>
                    <button
                        onClick={() => setShowQRCode(false)}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="text-center space-y-4">
                    {/* Hidden QR Code Canvas */}
                    <canvas
                        ref={canvasRef}
                        style={{ display: 'none' }}
                    />

                    {/* Composite QR Code with Tournament Info */}
                    <div className="flex justify-center">
                        <canvas
                            ref={compositeCanvasRef}
                            className="border border-gray-200 rounded shadow-sm max-w-full"
                            style={{ maxWidth: '100%', height: 'auto' }}
                        />
                    </div>

                    <div>
                        <p className="text-sm text-gray-600 mb-2">
                            Players can scan this QR code or visit:
                        </p>
                        <div className="bg-gray-50 p-2 rounded border text-xs font-mono break-all text-black">
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
                            Visit Link
                        </button>
                        <button
                            onClick={downloadQRCode}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center gap-2"
                            title="Download QR Code with Tournament Info"
                        >
                            <Download className="h-4 w-4" />
                            Download
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
