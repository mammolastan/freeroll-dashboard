// app/profile/page.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Camera, User, Save, Loader2 } from "lucide-react";


export default function ProfilePage() {
    const { data: session, status, update: updateSession } = useSession();
    const router = useRouter();

    const [nickname, setNickname] = useState("");
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Redirect if not authenticated
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login?callbackUrl=/profile");
        }
    }, [status, router]);

    // Load profile data
    useEffect(() => {
        if (session?.user?.uid) {
            fetchProfile();
        }
    }, [session?.user?.uid]);

    const fetchProfile = async () => {
        try {
            const res = await fetch("/api/profile");
            if (res.ok) {
                const data = await res.json();
                setNickname(data.nickname || "");
                setPhotoUrl(data.photo_url);
            }
        } catch (error) {
            console.error("Failed to load profile:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveNickname = async () => {
        setIsSaving(true);
        setMessage(null);

        try {
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nickname: nickname.trim() || null }),
            });

            if (res.ok) {
                const data = await res.json();
                setMessage({ type: "success", text: "Nickname updated!" });

                // Update the session so navbar/other components reflect change
                await updateSession({
                    name: session?.user?.name,
                    nickname: data.nickname,
                    image: session?.user?.image,
                });
            } else {
                const error = await res.json();
                setMessage({ type: "error", text: error.error || "Failed to update nickname" });
            }
        } catch {
            setMessage({ type: "error", text: "Something went wrong" });
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhotoClick = () => {
        fileInputRef.current?.click();
    };

    const resizeImage = (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Could not get canvas context'));
                        return;
                    }

                    // Max dimensions
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                resolve(blob);
                            } else {
                                reject(new Error('Could not create blob'));
                            }
                        },
                        'image/jpeg',
                        0.85
                    );
                };
                img.onerror = () => reject(new Error('Could not load image'));
                img.src = e.target?.result as string;
            };
            reader.onerror = () => reject(new Error('Could not read file'));
            reader.readAsDataURL(file);
        });
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith("image/")) {
            setMessage({ type: "error", text: "Please select an image file" });
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setMessage({ type: "error", text: "Image must be less than 5MB" });
            return;
        }

        setIsUploadingPhoto(true);
        setMessage(null);

        try {
            // Resize image to normalize camera photos and screenshots
            const resizedBlob = await resizeImage(file);
            const formData = new FormData();
            formData.append("photo", resizedBlob, file.name);

            const res = await fetch("/api/profile/photo", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                setPhotoUrl(data.photo_url);
                setMessage({ type: "success", text: "Photo updated!" });

                // Update session (non-blocking to avoid mobile timeout issues)
                updateSession({
                    name: session?.user?.name,
                    nickname: session?.user?.nickname,
                    image: data.photo_url,
                }).catch(() => {
                    // Ignore session update errors - photo is already uploaded
                });
            } else {
                const error = await res.json();
                setMessage({ type: "error", text: error.error || "Failed to upload photo" });
            }
        } catch {
            setMessage({ type: "error", text: "Failed to upload photo" });
        } finally {
            setIsUploadingPhoto(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleRemovePhoto = async () => {
        if (!confirm("Remove your profile photo?")) return;

        setIsUploadingPhoto(true);
        setMessage(null);

        try {
            const res = await fetch("/api/profile/photo", {
                method: "DELETE",
            });

            if (res.ok) {
                setPhotoUrl(null);
                setMessage({ type: "success", text: "Photo removed" });

                await updateSession({
                    name: session?.user?.name,
                    nickname: session?.user?.nickname,
                    image: null,
                });
            } else {
                setMessage({ type: "error", text: "Failed to remove photo" });
            }
        } catch {
            setMessage({ type: "error", text: "Something went wrong" });
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    if (status === "loading" || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
            </div>
        );
    }

    if (!session) {
        return null; // Will redirect in useEffect
    }

    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">My Profile</h1>

                {/* Message */}
                {message && (
                    <div
                        className={`mb-6 p-4 rounded-lg ${message.type === "success"
                            ? "bg-green-100 text-green-800 border border-green-200"
                            : "bg-red-100 text-red-800 border border-red-200"
                            }`}
                    >
                        {message.text}
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    {/* Profile Photo Section */}
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Photo</h2>

                        <div className="flex items-center gap-6">
                            {/* Photo */}
                            <div className="relative">
                                <button
                                    onClick={handlePhotoClick}
                                    disabled={isUploadingPhoto}
                                    className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-200 hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                >
                                    {photoUrl ? (
                                        <img
                                            src={photoUrl}
                                            alt="Profile"
                                            className="object-cover w-full h-full"
                                        />
                                    ) : (
                                        <User className="w-12 h-12 text-gray-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                    )}

                                    {/* Overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                        {isUploadingPhoto ? (
                                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                                        ) : (
                                            <Camera className="w-6 h-6 text-white" />
                                        )}
                                    </div>
                                </button>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoChange}
                                    className="hidden"
                                />
                            </div>

                            {/* Photo Actions */}
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={handlePhotoClick}
                                    disabled={isUploadingPhoto}
                                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                                >
                                    {isUploadingPhoto ? "Uploading..." : "Upload Photo"}
                                </button>

                                {photoUrl && (
                                    <button
                                        onClick={handleRemovePhoto}
                                        disabled={isUploadingPhoto}
                                        className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:underline"
                                    >
                                        Remove Photo
                                    </button>
                                )}
                            </div>
                        </div>

                        <p className="mt-3 text-sm text-gray-500">
                            Click the photo or button to upload. Max size: 5MB
                        </p>
                    </div>

                    {/* Basic Info Section */}
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Info</h2>

                        <div className="space-y-4">
                            {/* Name (read-only) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={session.user.name || ""}
                                    disabled
                                    className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-600"
                                />
                            </div>

                            {/* Email (read-only) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={session.user.email || ""}
                                    disabled
                                    className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-600"
                                />
                            </div>

                            {/* Nickname (editable) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Display name
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    <input
                                        type="text"
                                        value={nickname}
                                        onChange={(e) => setNickname(e.target.value)}
                                        placeholder="Enter a nickname"
                                        maxLength={50}
                                        autoComplete="nickname"
                                        className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        onClick={handleSaveNickname}
                                        disabled={isSaving}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center gap-2 whitespace-nowrap"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4" />
                                        )}
                                        Save
                                    </button>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    This is how you&apos;ll appear on leaderboards
                                </p>
                            </div>
                        </div>
                        {/* Sign Out Section */}
                        <div className="p-6 border-t border-gray-200">
                            <button
                                onClick={() => {
                                    signOut({ callbackUrl: "/" });
                                }}
                                className="px-4 py-2 hover:text-red-700 text-gray-800 rounded-md transition-colors bg-red-300/70"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}