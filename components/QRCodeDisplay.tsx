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
