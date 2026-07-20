import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  User as UserIcon, 
  Mail, 
  Calendar,
  LogOut,
  Settings as SettingsIcon,
  Crown,
  Bell,
  Download,
  Zap,
  Eye,
  EyeOff,
  Trash2,
  Shield,
  Camera,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { uploadsApi, usersApi } from "@/lib/api";

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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'premium' | 'pro'>('free');
  const [subscriptionExpiry, setSubscriptionExpiry] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
      loadPreferences();
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
        
        // Try to get subscription info
        if (data.subscription_tier) {
          setSubscriptionTier(data.subscription_tier);
        }
        if (data.subscription_expires_at) {
          setSubscriptionExpiry(data.subscription_expires_at);
        }
      }
    } catch (error) {
      logger.error('Error fetching profile:', error);
    }
    setIsLoading(false);
  };

  const loadPreferences = () => {
    const saved = localStorage.getItem('notificationsEnabled');
    if (saved !== null) setNotificationsEnabled(saved === 'true');
  };

  const savePreferences = () => {
    localStorage.setItem('notificationsEnabled', String(notificationsEnabled));
    toast.success("Preferences saved!");
  };

  const handleExportData = () => {
    // Generate CSV with trades data
    toast.info("Export feature coming soon!");
    // TODO: Implement CSV export
  };

  const handleDeleteAccount = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    
    toast.error("Account deletion coming soon!");
    // TODO: Implement account deletion
    setShowDeleteConfirm(false);
  };

  const handleAvatarClick = () => {
    if (isUploadingAvatar) return;
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, etc.)");
      return;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      toast.error(`Image is too large (${sizeMB}MB). Please choose an image under 2MB.`);
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const resp = await uploadsApi.uploadAvatar(file);
      setProfile((current) =>
        current
          ? { ...current, avatar_url: resp.avatar_url }
          : current,
      );
      toast.success("Avatar updated successfully!");
      await fetchProfile();
    } catch (error) {
      logger.error("Avatar upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload avatar. Please try again.");
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
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
      <main className="flex-1 px-6 space-y-6 overflow-y-auto animate-slide-up">
        {/* Avatar Section */}
        <div className="flex flex-col items-center">
          <div className="relative">
            {isUploadingAvatar ? (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <UserAvatar
                size="lg"
                name={profile?.full_name || user?.full_name}
                email={profile?.email || user?.email}
                src={profile?.avatar_url || user?.avatar_url}
              />
            )}
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={isUploadingAvatar}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand text-brand-foreground transition-all active:scale-95 disabled:opacity-50"
              aria-label="Upload profile photo"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-foreground">
            {profile?.full_name || "Trader"}
          </h2>
          <p className="text-muted-foreground">{profile?.email || user?.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">Tap the camera to update your photo</p>
          
          {/* Subscription Badge */}
          {subscriptionTier !== 'free' && (
            <div className="mt-3 flex items-center gap-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-black px-3 py-1 rounded-full text-sm font-semibold">
              <Crown className="w-4 h-4" />
              {subscriptionTier === 'premium' ? 'Premium' : 'Pro'}
              {subscriptionExpiry && (
                <span className="text-xs ml-1">
                  • Expires {new Date(subscriptionExpiry).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
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

        {/* Preferences Section */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-muted-foreground px-2">PREFERENCES</h3>

          <button
            onClick={() => navigate("/settings")}
            className="flex w-full items-center justify-between rounded-2xl bg-secondary p-4 transition-colors hover:bg-secondary/80"
          >
            <div className="flex items-center gap-3">
              <SettingsIcon className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <span className="text-sm font-medium text-foreground">Appearance</span>
                <p className="text-xs text-muted-foreground">Theme and display settings</p>
              </div>
            </div>
            <span className="text-xs font-medium text-brand">Open Settings</span>
          </button>

          {/* Notifications Toggle */}
          <div className="bg-secondary rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <div>
                <span className="text-sm font-medium text-foreground">Notifications</span>
                <p className="text-xs text-muted-foreground">{notificationsEnabled ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                notificationsEnabled ? 'bg-brand/20' : 'bg-background'
              }`}
            >
              {notificationsEnabled ? (
                <Eye className="w-5 h-5 text-brand" />
              ) : (
                <EyeOff className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Account Actions */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-muted-foreground px-2">ACCOUNT</h3>
          
          {/* Save Preferences Button */}
          <button
            onClick={savePreferences}
            className="w-full h-12 bg-secondary text-foreground font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
          >
            <Zap className="w-5 h-5" />
            Save Preferences
          </button>

          {/* Export Data Button */}
          <button
            onClick={handleExportData}
            className="w-full h-12 bg-secondary text-foreground font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
          >
            <Download className="w-5 h-5" />
            Export Trading Data
          </button>

          {/* Change Password Button */}
          <button
            onClick={() => navigate("/settings")}
            className="w-full h-12 bg-secondary text-foreground font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
          >
            <Shield className="w-5 h-5" />
            Security Settings
          </button>
        </div>

        {/* Edit Profile Buttons */}
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

          {/* Delete Account Button */}
          <button
            onClick={handleDeleteAccount}
            className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-[0.98] ${
              showDeleteConfirm
                ? 'bg-red-500/20 text-red-500'
                : 'bg-destructive/5 text-destructive/60 hover:bg-destructive/10'
            }`}
          >
            <Trash2 className="w-5 h-5" />
            {showDeleteConfirm ? 'Confirm Delete Account?' : 'Delete Account'}
          </button>
          {showDeleteConfirm && (
            <p className="text-xs text-red-500/70 text-center">This action cannot be undone</p>
          )}
        </div>
      </main>

    </div>
  );
};

export default Profile;
