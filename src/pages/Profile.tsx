import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  User as UserIcon,
  Mail,
  ChevronRight,
  LogOut,
  Download,
  Upload,
  Trash2,
  Camera,
  Loader2,
  Pencil,
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
import { parseAndValidateJournalImport } from "@/lib/importJournalCsv";
import { isPaymentsEnabled } from "@/lib/paymentsConfig";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDaysIcon } from "@/components/ui/calendar-days";
import { ReceiptIcon } from "@/components/ui/receipt";
import { UserAvatar } from "@/components/UserAvatar";
import { uploadsApi, usersApi } from "@/lib/api";
import { cn } from "@/lib/utils";
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

  const handleImportCsvFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user || !activeJournalId || isImporting) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const { validTrades, errors, source } = parseAndValidateJournalImport(
        text,
        { fileName: file.name },
      );
      if (validTrades.length === 0) {
        toast.error(errors[0] ?? "No valid trades found in this file.");
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
          `Imported ${validTrades.length} ${source === "mt5" ? "MT5 " : ""}trade${validTrades.length === 1 ? "" : "s"}; skipped ${errors.length} row${errors.length === 1 ? "" : "s"}.`,
        );
      } else {
        toast.success(
          `Imported ${validTrades.length} ${source === "mt5" ? "MT5 " : ""}trade${validTrades.length === 1 ? "" : "s"}.`,
        );
      }
    } catch (error) {
      logger.error("Trade import failed", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not import trades. Try again.",
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
      await fetchProfile();
    } catch (error) {
      logger.error("Profile update failed", error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setFullName(profile?.full_name || "");
    setIsEditing(false);
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

  const planLabel = subscriptionTier === "free"
    ? "Free"
    : subscriptionTier === "premium"
      ? "Premium"
      : "Pro";
  const memberSince = profile?.created_at ? formatDate(profile.created_at) : "—";

  if (isLoading) {
    return (
      <div className="flex min-h-full flex-col bg-background">
        <header className="px-6 pb-4 pt-[max(2rem,env(safe-area-inset-top))]">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-6 pb-10">
          <Skeleton className="h-72 w-full rounded-[1.75rem]" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/85 px-6 pb-4 pt-[max(2rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between animate-fade-in">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/80 text-foreground transition-colors hover:bg-secondary active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="text-center">
            <h1 className="font-display text-lg font-semibold text-foreground">
              Profile
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Account and data
            </p>
          </div>
          <span className="h-10 w-10" aria-hidden="true" />
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto w-full max-w-2xl flex-1 animate-slide-up space-y-5 px-6 py-5 pb-10"
      >
        <section
          aria-labelledby="profile-name"
          className="overflow-hidden rounded-[1.75rem] border border-border/60 bg-secondary/35"
        >
          <div className="px-5 pb-6 pt-7 text-center">
            <div className="relative mx-auto w-fit">
              <div className="rounded-full border border-brand/50 p-1.5">
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
              </div>
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={isUploadingAvatar}
                className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-4 border-secondary bg-brand text-brand-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                aria-label="Upload profile photo"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            <h2
              id="profile-name"
              className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground"
            >
              {profile?.full_name || "Trader"}
            </h2>
            <p className="mt-1 break-all text-sm text-muted-foreground">
              {profile?.email || user?.email}
            </p>
          </div>

          <div className="grid grid-cols-2 border-t border-border/50 bg-background/20">
            <div className="flex items-center justify-center gap-3 px-4 py-4">
              <ReceiptIcon
                aria-hidden="true"
                size={20}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand"
              />
              <div className="text-left">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Account
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {planLabel}
                </p>
                {subscriptionExpiry ? (
                  <p className="text-[10px] text-muted-foreground">
                    Until {new Date(subscriptionExpiry).toLocaleDateString()}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 border-l border-border/50 px-4 py-4">
              <CalendarDaysIcon
                aria-hidden="true"
                size={20}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/5 text-muted-foreground"
              />
              <div className="text-left">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Member since
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {memberSince}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="account-details-heading">
          <div className="mb-2 flex items-center justify-between px-1">
            <div>
              <h3
                id="account-details-heading"
                className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
              >
                Account details
              </h3>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Your public profile information
              </p>
            </div>
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edit
              </button>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/60 bg-secondary/35">
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/5 text-muted-foreground">
                <UserIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Full name</p>
                {isEditing ? (
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand"
                    placeholder="Enter your name"
                    aria-label="Full name"
                  />
                ) : (
                  <p className="truncate text-sm font-semibold text-foreground">
                    {profile?.full_name || "Not set"}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-border/50 px-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/5 text-muted-foreground">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="break-all text-sm font-semibold text-foreground">
                  {profile?.email || user?.email}
                </p>
              </div>
            </div>
          </div>

          {isEditing ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="h-11 rounded-xl bg-secondary text-sm font-semibold text-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving || !fullName.trim()}
                className="h-11 rounded-xl bg-foreground text-sm font-semibold text-background transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {isSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="trading-data-heading">
          <div className="mb-2 px-1">
            <h3
              id="trading-data-heading"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              Trading data
            </h3>
          </div>

          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,.tsv,.txt,.html,.htm,text/csv,text/tab-separated-values,text/plain,text/html"
            className="hidden"
            onChange={(event) => void handleImportCsvFile(event)}
          />

          <div className="overflow-hidden rounded-2xl border border-border/60 bg-secondary/35">
            <button
              type="button"
              onClick={() => void handleExportData()}
              disabled={isExporting || isImporting}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-secondary/50 active:scale-[0.99] disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/5 text-muted-foreground">
                  {isExporting ? (
                    <Loader2
                      className="h-5 w-5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Download className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {isExporting ? "Exporting…" : "Export data"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Download trades as CSV
                  </p>
                </div>
              </div>
              <ChevronRight
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              onClick={handleImportCsvClick}
              disabled={isImporting || isExporting}
              className="flex w-full items-center justify-between gap-3 border-t border-border/50 px-4 py-4 text-left transition-colors hover:bg-secondary/50 active:scale-[0.99] disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/5 text-muted-foreground">
                  {isImporting ? (
                    <Loader2
                      className="h-5 w-5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Upload className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {isImporting ? "Importing…" : "Import trades"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    MT5 history or Poscal CSV
                  </p>
                </div>
              </div>
              <ChevronRight
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          </div>
        </section>

        <section aria-labelledby="account-access-heading">
          <div className="mb-2 px-1">
            <h3
              id="account-access-heading"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              Account access
            </h3>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/60 bg-secondary/35">
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-secondary/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/5 text-muted-foreground">
                  <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Sign out
                  </p>
                  <p className="text-xs text-muted-foreground">
                    End this session
                  </p>
                </div>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          </div>
        </section>

        <section aria-labelledby="danger-zone-heading">
          <div className="mb-2 px-1">
            <h3
              id="danger-zone-heading"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-destructive/70"
            >
              Danger zone
            </h3>
          </div>

          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={isDeletingAccount}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition-colors active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50",
              showDeleteConfirm
                ? "border-destructive/40 bg-destructive/15 text-destructive"
                : "border-destructive/15 bg-destructive/5 text-destructive/80 hover:bg-destructive/10",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10">
                {isDeletingAccount ? (
                  <Loader2
                    className="h-[18px] w-[18px] animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {isDeletingAccount
                    ? "Deleting account…"
                    : showDeleteConfirm
                      ? "Confirm account deletion"
                      : "Delete account"}
                </p>
                <p className="text-xs opacity-70">
                  {showDeleteConfirm
                    ? "Tap once more to permanently delete"
                    : "Permanently remove all Poscal data"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>

          {showDeleteConfirm ? (
            <p className="px-3 pt-2 text-center text-xs leading-relaxed text-destructive/70">
              Permanently deletes journals, trades, history, and your login.
              This cannot be undone.
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
};

export default Profile;
