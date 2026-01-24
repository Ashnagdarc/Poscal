import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Camera, 
  User as UserIcon, 
  Mail, 
  Calendar,
  LogOut,
  Settings as SettingsIcon,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";
import { BottomNav } from "@/components/BottomNav";
import { Skeleton } from "@/components/ui/skeleton";
import { usersApi, uploadsApi } from "@/lib/api";

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const data = await usersApi.getProfile();
      if (data) {
        setProfile({
          id: data.id,
          email: data.email || null,
          full_name: data.full_name || null,
          avatar_url: data.avatar_url || null,
          created_at: data.created_at || new Date().toISOString(),
        });
        setFullName(data.full_name || "");
      }
    } catch (error) {
      logger.error('Error fetching profile:', error);
    }
    setIsLoading(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      // Upload new avatar via backend
      const resp = await uploadsApi.uploadAvatar(file);
      // Optionally delete old avatar if backend supports it
      if (profile?.avatar_url && resp?.previous_id) {
        try { await uploadsApi.deleteAvatar(resp.previous_id); } catch {}
      }

      // Refresh profile
      await fetchProfile();

      toast.success("Avatar updated!");
      fetchProfile();
    } catch (error) {
      logger.error('Avatar upload error:', error);
      const message = error instanceof Error ? error.message : '';
      if (message.includes('bucket') || message.includes('not found')) {
        toast.error("Storage not configured. Please run the SQL migration.");
      } else {
        toast.error("Failed to upload avatar");
      }
    } finally {
      setIsUploadingAvatar(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      await usersApi.updateProfile({ full_name: fullName });
      toast.success("Profile updated");
      setIsEditing(false);
      fetchProfile();
    } catch (error) {
      toast.error("Failed to update profile");
    }
    setIsSaving(false);
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/signin");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col pb-24">
        <header className="pt-12 pb-6 px-6 flex items-center justify-between">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="w-20 h-6" />
          <Skeleton className="w-10 h-10 rounded-xl" />
        </header>
        <main className="flex-1 px-6 space-y-6">
          <div className="flex flex-col items-center">
            <Skeleton className="w-24 h-24 rounded-full" />
            <Skeleton className="w-32 h-8 mt-4" />
            <Skeleton className="w-48 h-5 mt-2" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* Header */}
      <header className="pt-12 pb-6 px-6 flex items-center justify-between animate-fade-in">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Profile</h1>
        <button
          onClick={() => navigate("/settings")}
          className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
        >
          <SettingsIcon className="w-5 h-5 text-foreground" />
        </button>
      </header>

      {/* Profile Content */}
      <main className="flex-1 px-6 space-y-6 animate-slide-up">
        {/* Avatar Section */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center overflow-hidden">
              {isUploadingAvatar ? (
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              ) : profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="Avatar" 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <UserIcon className="w-12 h-12 text-muted-foreground" />
              )}
            </div>
            <button 
              onClick={handleAvatarClick}
              disabled={isUploadingAvatar}
              className="absolute bottom-0 right-0 w-8 h-8 bg-foreground rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              <Camera className="w-4 h-4 text-background" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <h2 className="text-2xl font-bold text-foreground mt-4">
            {profile?.full_name || "Trader"}
          </h2>
          <p className="text-muted-foreground">{profile?.email || user?.email}</p>
        </div>

        {/* Profile Info */}
        <div className="space-y-3">
          <div className="bg-secondary rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <UserIcon className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Full Name</span>
            </div>
            {isEditing ? (
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-12 px-4 bg-background text-foreground text-lg font-medium rounded-xl border-0 outline-none"
                placeholder="Enter your name"
              />
            ) : (
              <p className="text-lg font-medium text-foreground">
                {profile?.full_name || "Not set"}
              </p>
            )}
          </div>

          <div className="bg-secondary rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Email</span>
            </div>
            <p className="text-lg font-medium text-foreground">
              {profile?.email || user?.email}
            </p>
          </div>

          <div className="bg-secondary rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Member Since</span>
            </div>
            <p className="text-lg font-medium text-foreground">
              {profile?.created_at ? formatDate(profile.created_at) : "—"}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          {isEditing ? (
            <div className="flex gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 h-12 bg-secondary text-foreground font-semibold rounded-xl transition-all duration-200 active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 h-12 bg-foreground text-background font-semibold rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full h-12 bg-secondary text-foreground font-semibold rounded-xl transition-all duration-200 active:scale-[0.98]"
            >
              Edit Profile
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full h-12 bg-destructive/10 text-destructive font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Profile;