import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
  Upload,
  Trash2,
  Shield,
  Camera,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { useAuth } from "@/contexts/AuthContext";
import { useJournal } from "@/contexts/JournalContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { TRADES_QUERY_KEY } from "@/hooks/queries/use-trades-query";
import { logger } from "@/lib/logger";
import {
  importJournalEntries,
  JOURNAL_FETCH_LIMIT,
  listJournalEntriesWithMeta,
} from "@/lib/convexJournal";
import {
  buildExportFilename,
  downloadCsv,
  tradesToCsv,
} from "@/lib/exportJournalCsv";
import { parseAndValidateJournalCsv } from "@/lib/importJournalCsv";
import { isPaymentsEnabled } from "@/lib/paymentsConfig";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { uploadsApi, usersApi } from "@/lib/api";
import { api } from "../../convex/_generated/api";

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const { activeJournalId } = useJournal();
  const { checkFeatureAccess } = useSubscription();
  const deleteAccount = useMutation(api.users.deleteAccount);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'premium' | 'pro'>('free');
  const [subscriptionExpiry, setSubscriptionExpiry] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

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

  const handleExportData = async () => {
    if (!user || isExporting) return;

    // While checkout is paused, keep export available to signed-in users.
    if (isPaymentsEnabled() && !checkFeatureAccess("export_csv")) {
      toast.info("CSV export is a premium feature.");
      navigate("/upgrade?tier=premium&redirectPath=/profile");
      return;
    }

    setIsExporting(true);
    try {
      const { trades, truncated } = await listJournalEntriesWithMeta(user.id);
      if (trades.length === 0) {
        toast.info("No trades to export yet.");
        return;
      }

      const csv = tradesToCsv(trades);
      downloadCsv(buildExportFilename(), csv);
      toast.success(
        truncated
          ? `Exported the ${JOURNAL_FETCH_LIMIT} most recent trades.`
          : `Exported ${trades.length} trade${trades.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      logger.error("CSV export failed", error);
      toast.error(
        error instanceof Error ? error.message : "Could not export trades. Try again.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportCsvClick = () => {
    if (!user || isImporting) return;
    if (isPaymentsEnabled() && !checkFeatureAccess("export_csv")) {
      toast.info("CSV import is a premium feature.");
      navigate("/upgrade?tier=premium&redirectPath=/profile");
      return;
    }
    if (!activeJournalId) {
      toast.info("Create or select a journal before importing trades.");
      navigate("/journal");
      return;
    }
    csvInputRef.current?.click();
  };

  const handleImportCsvFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user || !activeJournalId || isImporting) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const { validTrades, errors } = parseAndValidateJournalCsv(text);
      if (validTrades.length === 0) {
        toast.error(errors[0] ?? "No valid trades found in CSV.");
        return;
      }

      await importJournalEntries(
        user.id,
        validTrades.map((trade) => ({
          ...trade,
          journal_id: activeJournalId,
        })),
      );
      await queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });

      if (errors.length > 0) {
        toast.warning(
          `Imported ${validTrades.length} trade${validTrades.length === 1 ? "" : "s"}; skipped ${errors.length} row${errors.length === 1 ? "" : "s"}.`,
        );
      } else {
        toast.success(
          `Imported ${validTrades.length} trade${validTrades.length === 1 ? "" : "s"}.`,
        );
      }
    } catch (error) {
      logger.error("CSV import failed", error);
      toast.error(
        error instanceof Error ? error.message : "Could not import trades. Try again.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    if (isDeletingAccount) return;
    setIsDeletingAccount(true);
    try {
      await deleteAccount({ confirmation: "DELETE" });
      await signOut();
      toast.success("Your account and trading data have been deleted.");
      navigate("/welcome");
    } catch (error) {
      console.error("[profile] Account deletion failed", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete account. Please try again.",
      );
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
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

          <button
            onClick={() => navigate("/settings")}
            className="flex w-full items-center justify-between rounded-2xl bg-secondary p-4 transition-colors hover:bg-secondary/80"
          >
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <span className="text-sm font-medium text-foreground">Notifications</span>
                <p className="text-xs text-muted-foreground">Push and calendar alerts in Settings</p>
              </div>
            </div>
            <span className="text-xs font-medium text-brand">Open Settings</span>
          </button>
        </div>

        {/* Account Actions */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-muted-foreground px-2">ACCOUNT</h3>

          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => void handleImportCsvFile(event)}
          />

          {/* Export Data Button */}
          <button
            type="button"
            onClick={() => void handleExportData()}
            disabled={isExporting || isImporting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary font-semibold text-foreground transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
            {isExporting ? "Exporting…" : "Export Trading Data"}
          </button>

          <button
            type="button"
            onClick={handleImportCsvClick}
            disabled={isImporting || isExporting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary font-semibold text-foreground transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
          >
            {isImporting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
            {isImporting ? "Importing…" : "Import Trading CSV"}
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
            disabled={isDeletingAccount}
            className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
              showDeleteConfirm
                ? 'bg-red-500/20 text-red-500'
                : 'bg-destructive/5 text-destructive/60 hover:bg-destructive/10'
            }`}
          >
            <Trash2 className="w-5 h-5" />
            {isDeletingAccount
              ? "Deleting..."
              : showDeleteConfirm
                ? "Confirm Delete Account?"
                : "Delete Account"}
          </button>
          {showDeleteConfirm && (
            <p className="text-xs text-red-500/70 text-center">
              Permanently deletes journals, trades, history, and your login. This cannot be undone.
            </p>
          )}
        </div>
      </main>

    </div>
  );
};

export default Profile;
