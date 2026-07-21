import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, RefreshCw, Search, Shield, ShieldOff, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/use-admin";
import { useAuth } from "@/contexts/AuthContext";
import { adminUsersApi, featureFlagApi } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AdminUserRow {
  id: string;
  full_name: string | null;
  email: string;
  is_admin: boolean;
  account_type: string | null;
  created_at: string;
  subscription_tier: string;
  subscription_end: string | null;
}

const USERS_PER_PAGE = 15;

function getTierLabel(tier: string | null | undefined) {
  const normalized = (tier || "free").toLowerCase();
  if (normalized === "pro") return "Pro";
  if (normalized === "premium") return "Premium";
  if (normalized === "trial") return "Trial";
  return "Free";
}

function getTierBadgeClass(tier: string | null | undefined) {
  const normalized = (tier || "free").toLowerCase();
  if (normalized === "pro" || normalized === "premium") {
    return "bg-brand/15 text-brand border-brand/20";
  }
  if (normalized === "trial") {
    return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20";
  }
  return "bg-secondary text-muted-foreground border-border/50";
}

const UserManagement = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [paidLockEnabled, setPaidLockEnabled] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchUsers = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await adminUsersApi.getAll();
      setUsers(data || []);
    } catch (err) {
      toast.error("Failed to fetch users");
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPaidLock = async () => {
    try {
      const enabled = await featureFlagApi.getPaidLock();
      setPaidLockEnabled(!!enabled);
    } catch (err) {
      console.error("Could not fetch paid lock flag", err);
      setPaidLockEnabled(false);
    }
  };

  const togglePaidLock = async () => {
    try {
      const desiredState = !(paidLockEnabled ?? false);
      const updatedState = await featureFlagApi.setPaidLock(desiredState);
      setPaidLockEnabled(!!updatedState);
      toast.success(updatedState ? "Paid lock enabled" : "Paid lock disabled");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle paid lock");
    }
  };

  const handleSetAdmin = async (user: AdminUserRow, makeAdmin: boolean) => {
    if (user.id === currentUser?.id) {
      toast.error("You cannot change your own admin role");
      return;
    }

    setUpdatingUserId(user.id);
    try {
      const result = await adminUsersApi.setRole(user.id, makeAdmin);
      setUsers((prev) =>
        prev.map((row) =>
          row.id === user.id
            ? {
                ...row,
                is_admin: result.is_admin,
                account_type: result.role,
              }
            : row,
        ),
      );
      toast.success(
        makeAdmin
          ? `${user.full_name || user.email} is now an admin`
          : `Admin access removed from ${user.full_name || user.email}`,
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update admin role");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const isSuperAdminAccount = (user: AdminUserRow) =>
    (user.account_type || "").toLowerCase() === "super_admin";

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate("/settings");
      return;
    }
    if (isAdmin) {
      fetchUsers();
      fetchPaidLock();
    }
  }, [isAdmin, adminLoading, navigate]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      return (
        u.email.toLowerCase().includes(q) ||
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.subscription_tier || "").toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  const stats = useMemo(() => {
    const admins = users.filter((u) => u.is_admin).length;
    const premium = users.filter((u) => {
      const tier = (u.subscription_tier || "free").toLowerCase();
      return tier !== "free";
    }).length;
    return { total: users.length, admins, premium };
  }, [users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const pageStart = (currentPage - 1) * USERS_PER_PAGE;
  const pageUsers = filteredUsers.slice(pageStart, pageStart + USERS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  if (adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <PageHeader
        title="User Management"
        subtitle="Accounts, roles, and subscriptions"
        icon={<Users className="h-5 w-5" />}
        leading={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
            aria-label="Back to settings"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        }
        actions={
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl"
            onClick={() => fetchUsers(true)}
            disabled={refreshing}
            aria-label="Refresh users"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        }
      />

      <main className="mx-auto max-w-2xl space-y-6 px-6 md:max-w-3xl">
        {/* Paid lock */}
        <section className="overflow-hidden rounded-2xl border border-border/50 bg-secondary/50">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/10">
                <Shield className="h-4 w-4 text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground">Paid features lock</p>
                <p className="text-xs text-muted-foreground">
                  Restrict premium pages for free users
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={paidLockEnabled ? "default" : "outline"}
              className="shrink-0 rounded-xl"
              onClick={togglePaidLock}
            >
              {paidLockEnabled ? "Enabled" : "Disabled"}
            </Button>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-3 gap-3">
          <StatPill label="Total" value={loading ? "—" : String(stats.total)} />
          <StatPill label="Premium" value={loading ? "—" : String(stats.premium)} accent />
          <StatPill label="Admins" value={loading ? "—" : String(stats.admins)} />
        </section>

        {/* Search + list */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Users
            </h2>
            {!loading && (
              <span className="text-xs text-muted-foreground">
                {filteredUsers.length} {filteredUsers.length === 1 ? "user" : "users"}
              </span>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, or tier…"
              className="h-11 rounded-xl border-border/50 bg-secondary/40 pl-10"
            />
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-2xl border border-border/50 bg-secondary/30 px-5 py-4"
                >
                  <Skeleton className="h-11 w-11 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : pageUsers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/30 px-6 py-12 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <h3 className="font-semibold text-foreground">No users found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery.trim()
                  ? "Try a different search term."
                  : "Users will appear here once they sign up."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pageUsers.map((user) => (
                <article
                  key={user.id}
                  className="overflow-hidden rounded-2xl border border-border/50 bg-secondary/40 transition-colors hover:bg-secondary/60"
                >
                  <div className="flex items-center gap-4 px-5 py-4">
                    <UserAvatar
                      name={user.full_name}
                      email={user.email}
                      size="md"
                      className="rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold text-foreground">
                          {user.full_name || "Unnamed user"}
                        </h3>
                        {user.is_admin && (
                          <Badge
                            variant="outline"
                            className="rounded-full border-brand/30 bg-brand/10 text-[10px] uppercase tracking-wide text-brand"
                          >
                            Admin
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                      {user.created_at && (
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          Joined {format(new Date(user.created_at), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="mb-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                        {(user.subscription_tier || "free").toLowerCase() !== "free" && (
                          <Crown className="h-3 w-3" />
                        )}
                        <span>Plan</span>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full text-[10px] font-semibold uppercase tracking-wide",
                          getTierBadgeClass(user.subscription_tier),
                        )}
                      >
                        {getTierLabel(user.subscription_tier)}
                      </Badge>
                      {user.subscription_end && (
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          Expires {format(new Date(user.subscription_end), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                  {user.id !== currentUser?.id && !isSuperAdminAccount(user) && (
                    <div className="border-t border-border/40 bg-background/20 px-5 py-3">
                      {user.is_admin ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-full rounded-lg text-xs"
                          disabled={updatingUserId === user.id}
                          onClick={() => handleSetAdmin(user, false)}
                        >
                          <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                          {updatingUserId === user.id ? "Updating…" : "Remove admin"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="h-8 w-full rounded-lg bg-brand text-xs text-brand-foreground hover:bg-brand/90"
                          disabled={updatingUserId === user.id}
                          onClick={() => handleSetAdmin(user, true)}
                        >
                          <Shield className="mr-1.5 h-3.5 w-3.5" />
                          {updatingUserId === user.id ? "Updating…" : "Make admin"}
                        </Button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {!loading && filteredUsers.length > USERS_PER_PAGE && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-secondary/30 px-4 py-3">
              <span className="text-xs text-muted-foreground">
                Showing {pageStart + 1}–{Math.min(pageStart + USERS_PER_PAGE, filteredUsers.length)} of{" "}
                {filteredUsers.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <span className="min-w-[4.5rem] text-center text-xs font-medium text-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

function StatPill({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/40 px-4 py-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-display text-xl font-semibold text-foreground",
          accent && "text-brand",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export default UserManagement;
