// app/profile/CropModal.tsx
"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { X, Check } from "lucide-react";

interface CropModalProps {
    imageSrc: string;
    onCropComplete: (croppedBlob: Blob) => void;
    onCancel: () => void;
}

interface CropArea {
    x: number;
    y: number;
    width: number;
    height: number;
}

export default function CropModal({ imageSrc, onCropComplete, onCancel }: CropModalProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropChange = (crop: { x: number; y: number }) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    const onCropCompleteInternal = useCallback(
        (croppedArea: CropArea, croppedAreaPixels: CropArea) => {
            setCroppedAreaPixels(croppedAreaPixels);
        },
        []
    );

    const createCroppedImage = async (): Promise<Blob> => {
        if (!croppedAreaPixels) {
            throw new Error("No crop area selected");
        }

        return new Promise((resolve, reject) => {
            const image = new Image();
            image.src = imageSrc;
            image.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");

                if (!ctx) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }

                // Set canvas size to the cropped area
                canvas.width = croppedAreaPixels.width;
                canvas.height = croppedAreaPixels.height;

                // Draw the cropped image
                ctx.drawImage(
                    image,
                    croppedAreaPixels.x,
                    croppedAreaPixels.y,
                    croppedAreaPixels.width,
                    croppedAreaPixels.height,
                    0,
                    0,
                    croppedAreaPixels.width,
                    croppedAreaPixels.height
                );

                // Convert to blob
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error("Could not create blob"));
                        }
                    },
                    "image/jpeg",
                    0.95
                );
            };
            image.onerror = () => reject(new Error("Could not load image"));
        });
    };

    const handleConfirm = async () => {
        setIsProcessing(true);
        try {
            const croppedBlob = await createCroppedImage();
            onCropComplete(croppedBlob);
        } catch (error) {
            console.error("Error cropping image:", error);
            alert("Failed to crop image. Please try again.");
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Crop Photo</h2>
                    <button
                        onClick={onCancel}
                        disabled={isProcessing}
                        className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Cropper */}
                <div className="relative h-96 bg-gray-900">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={onCropChange}
                        onZoomChange={onZoomChange}
                        onCropComplete={onCropCompleteInternal}
                        cropShape="rect"
                        showGrid={true}
                    />
                </div>

                {/* Zoom Control */}
                <div className="p-4 border-b border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Zoom
                    </label>
                    <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.1}
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-full"
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 p-4">
                    <button
                        onClick={onCancel}
                        disabled={isProcessing}
                        className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isProcessing}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center gap-2"
                    >
                        {isProcessing ? (
                            <>Processing...</>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                Confirm
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
