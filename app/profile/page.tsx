// app/profile/page.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Camera, User, Save, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import CropModal from "./CropModal";

export default function ProfilePage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();

  const [nickname, setNickname] = useState("");
  const [favoriteHand, setFavoriteHand] = useState("");
  const [favoritePro, setFavoritePro] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
        setFavoriteHand(data.favorite_hand || "");
        setFavoritePro(data.favorite_pro || "");
        setPhotoUrl(data.photo_url);
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim() || null,
          favorite_hand: favoriteHand.trim() || null,
          favorite_pro: favoritePro.trim() || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage({ type: "success", text: "Profile updated!" });

        // Update the session so navbar/other components reflect change
        await updateSession({
          name: session?.user?.name,
          nickname: data.nickname,
          image: session?.user?.image,
        });
      } else {
        const error = await res.json();
        setMessage({
          type: "error",
          text: error.error || "Failed to update profile",
        });
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

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Please select an image file" });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: "error", text: "Image must be less than 10MB" });
      return;
    }

    setMessage(null);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // GIFs: skip crop modal to preserve animation, upload directly
    if (file.type === "image/gif") {
      await uploadPhotoDirect(file);
      return;
    }

    // Other formats: show crop modal
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setSelectedFileName(file.name);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  const uploadPhotoDirect = async (file: File) => {
    setIsUploadingPhoto(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("photo", file, file.name);

      const res = await fetch("/api/profile/photo", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setPhotoUrl(data.photo_url);
        setMessage({ type: "success", text: "Photo updated!" });

        updateSession({
          name: session?.user?.name,
          nickname: session?.user?.nickname,
          image: data.photo_url,
        }).catch(() => {
          // Ignore session update errors - photo is already uploaded
        });
      } else {
        const error = await res.json();
        setMessage({
          type: "error",
          text: error.error || "Failed to upload photo",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to upload photo" });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setShowCropModal(false);
    setIsUploadingPhoto(true);
    setMessage(null);

    try {
      // Send cropped image directly - Sharp handles resize/compression server-side
      const formData = new FormData();
      formData.append("photo", croppedBlob, selectedFileName);

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
        setMessage({
          type: "error",
          text: error.error || "Failed to upload photo",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to upload photo" });
    } finally {
      setIsUploadingPhoto(false);
      setSelectedImage(null);
    }
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    setSelectedImage(null);
    setSelectedFileName("");
  };

  const handleChangePassword = async () => {
    setPasswordMessage(null);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordMessage({ type: "error", text: "All fields are required" });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage({
        type: "error",
        text: "New password must be at least 8 characters",
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match" });
      return;
    }

    setIsChangingPassword(true);

    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.ok) {
        setPasswordMessage({ type: "success", text: "Password changed successfully!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        const error = await res.json();
        setPasswordMessage({
          type: "error",
          text: error.error || "Failed to change password",
        });
      }
    } catch {
      setPasswordMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setIsChangingPassword(false);
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
            className={`mb-6 p-4 rounded-lg ${
              message.type === "success"
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Profile Photo
            </h2>

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
              Click the photo or button to upload. Max size: 10MB
            </p>
          </div>

          {/* Basic Info Section */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Basic Info
            </h2>

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
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Enter a nickname"
                  maxLength={50}
                  autoComplete="nickname"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This is how you&apos;ll appear on leaderboards
                </p>
              </div>

              {/* Favorite Hand */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Favorite Hand
                </label>
                <input
                  type="text"
                  value={favoriteHand}
                  onChange={(e) => setFavoriteHand(e.target.value)}
                  placeholder=""
                  maxLength={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Favorite Pro */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Favorite Pro Player
                </label>
                <input
                  type="text"
                  value={favoritePro}
                  onChange={(e) => setFavoritePro(e.target.value)}
                  placeholder=""
                  maxLength={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Save Button */}
              <div className="pt-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Profile
                </button>
              </div>
            </div>

            {/* Change Password Section */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <KeyRound className="w-5 h-5" />
                Change Password
              </h2>

              {passwordMessage && (
                <div
                  className={`mb-4 p-3 rounded-lg ${
                    passwordMessage.type === "success"
                      ? "bg-green-100 text-green-800 border border-green-200"
                      : "bg-red-100 text-red-800 border border-red-200"
                  }`}
                >
                  {passwordMessage.text}
                </div>
              )}

              <div className="space-y-4">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Must be at least 8 characters
                  </p>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoComplete="new-password"
                  />
                </div>

                {/* Change Password Button */}
                <div className="pt-2">
                  <button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword}
                    className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                  >
                    {isChangingPassword ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <KeyRound className="w-4 h-4" />
                    )}
                    Change Password
                  </button>
                </div>
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

      {/* Crop Modal */}
      {showCropModal && selectedImage && (
        <CropModal
          imageSrc={selectedImage}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
