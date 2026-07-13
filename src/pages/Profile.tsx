import { useState, useEffect } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User as UserIcon,
  Mail,
  Calendar,
  LogOut,
  Settings as SettingsIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getUserProfile, updateUserProfile } from "@/lib/convexProfiles";
import { logger } from "@/lib/logger";
import { Skeleton } from "@/components/ui/skeleton";

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
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

  useEffect(() => {
    if (user) {
      fetchProfile();
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
          created_at: data.created_at || new Date().toISOString(),
        });
        setFullName(data.full_name || "");
      }
    } catch (error) {
      logger.error('Error fetching profile:', error);
    }
    setIsLoading(false);
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
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border/60 bg-background/95 px-4 pb-4 pt-10 md:px-6">
          <div className="flex items-center justify-between">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="w-20 h-6" />
          <Skeleton className="w-10 h-10 rounded-xl" />
          </div>
        </header>
        <main className="flex-1 px-4 py-4 md:px-6 space-y-6">
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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 px-4 pb-4 pt-10 backdrop-blur md:px-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-secondary rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Profile</h1>
          <button
            onClick={() => navigate("/settings")}
            className="w-10 h-10 bg-secondary rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95"
          >
            <SettingsIcon className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 animate-slide-up">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <UserIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {profile?.full_name || "User"}
                </h2>
                <p className="text-muted-foreground">{profile?.email || user?.email}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <UserIcon className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Full Name</span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-12 px-4 bg-background text-foreground text-lg font-medium rounded-2xl border border-border outline-none"
                  placeholder="Enter your name"
                />
              ) : (
                <p className="text-lg font-medium text-foreground">
                  {profile?.full_name || "Not set"}
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Email</span>
              </div>
              <p className="text-lg font-medium text-foreground">
                {profile?.email || user?.email}
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Member Since</span>
              </div>
              <p className="text-lg font-medium text-foreground">
                {profile?.created_at ? formatDate(profile.created_at) : "—"}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="h-12 bg-secondary text-foreground font-semibold rounded-2xl transition-all duration-200 active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="h-12 bg-foreground text-background font-semibold rounded-2xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="h-12 bg-secondary text-foreground font-semibold rounded-2xl transition-all duration-200 active:scale-[0.98]"
                >
                  Edit Profile
                </button>
                <button
                  onClick={() => navigate("/settings")}
                  className="h-12 bg-secondary text-foreground font-semibold rounded-2xl transition-all duration-200 active:scale-[0.98]"
                >
                  Open Settings
                </button>
              </>
            )}
            <button
              onClick={handleLogout}
              className="sm:col-span-2 h-12 bg-destructive/10 text-destructive font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
