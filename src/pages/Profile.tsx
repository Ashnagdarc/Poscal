import { useState, useEffect, useRef } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Camera, 
  User as UserIcon, 
  Mail, 
  Calendar,
  LogOut,
  Settings as SettingsIcon,
  Loader2,
  Moon,
  Sun,
  Shield
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getUserProfile, updateUserProfile } from "@/lib/convexProfiles";
import { logger } from "@/lib/logger";
import { BottomNav } from "@/components/BottomNav";
import { Skeleton } from "@/components/ui/skeleton";

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
  const authToken = useAuthToken();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark');
  };

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
      const data = await getUserProfile(user, authToken);
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

  const loadPreferences = () => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'dark';
    setTheme(savedTheme);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file (PNG, JPG, etc.)");
      return;
    }

    // Strict file size validation (1MB limit for better compatibility)
    const maxSize = 1 * 1024 * 1024; // 1MB
    if (file.size > maxSize) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      toast.error(`Image is too large (${sizeMB}MB). Please choose an image under 1MB.`);
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Could not read image file"));
        reader.readAsDataURL(file);
      });

      await updateUserProfile(user, {
        full_name: fullName || profile?.full_name || user.full_name || null,
        avatar_url: dataUrl,
        email: user.email,
      }, authToken);

      await fetchProfile();

      toast.success("Avatar updated successfully!");
    } catch (error: unknown) {
      logger.error('Avatar upload error:', error);

      toast.error(error instanceof Error ? error.message : "Failed to upload avatar. Please try again.");
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
      await updateUserProfile(user, { full_name: fullName }, authToken);
      toast.success("Profile updated");
      setIsEditing(false);
      fetchProfile();
    } catch {
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
      <main className="flex-1 px-6 space-y-6 overflow-y-auto animate-slide-up">
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
            {profile?.full_name || "User"}
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

        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-muted-foreground px-2">PREFERENCES</h3>
          
          {/* Theme Toggle */}
          <div className="bg-secondary rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-muted-foreground" />
              ) : (
                <Sun className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <span className="text-sm font-medium text-foreground">Theme</span>
                <p className="text-xs text-muted-foreground capitalize">{theme}</p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className="w-10 h-10 bg-background rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-foreground" />
              ) : (
                <Moon className="w-5 h-5 text-foreground" />
              )}
            </button>
          </div>

        </div>

        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-muted-foreground px-2">ACCOUNT</h3>
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
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Profile;
