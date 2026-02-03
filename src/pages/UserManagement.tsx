import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/use-admin";
import { BottomNav } from "@/components/BottomNav";
import { adminUsersApi, featureFlagApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

const UserManagement = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [paidLockEnabled, setPaidLockEnabled] = useState<boolean | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await adminUsersApi.getAll();
      setUsers(data || []);
    } catch (err) {
      toast.error("Failed to fetch users");
      console.error(err);
    } finally {
      setLoading(false);
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

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const pageStart = (currentPage - 1) * USERS_PER_PAGE;
  const pageUsers = filteredUsers.slice(pageStart, pageStart + USERS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, totalPages]);

  if (adminLoading || (isAdmin && loading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="pt-12 pb-4 px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">User Management</h1>
              <p className="text-sm text-muted-foreground">Name, email, and subscription tier</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="text-sm text-muted-foreground">Paid lock:</div>
            <span className={`text-xs px-2 py-1 rounded-full ${paidLockEnabled ? "bg-primary/20 text-primary" : "bg-secondary/50 text-muted-foreground"}`}>
              {paidLockEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
      </header>

      <main className="px-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, tier..."
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchUsers} title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid gap-3">
          {pageUsers.map((user) => (
            <div
              key={user.id}
              className="w-full bg-secondary/50 backdrop-blur-sm rounded-2xl px-5 py-4 border border-border/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground">
                    {user.full_name || "Unnamed User"}
                    {user.is_admin && (
                      <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Subscription</div>
                  <div className="text-sm font-semibold text-foreground">
                    {(user.subscription_tier || "free").toUpperCase()}
                  </div>
                  {user.subscription_end && (
                    <div className="text-xs text-muted-foreground">
                      Expires {new Date(user.subscription_end).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {pageUsers.length === 0 && (
            <div className="text-center text-muted-foreground py-10">No users found.</div>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
          <span>
            Showing {pageUsers.length} of {filteredUsers.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <span>
              Page {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default UserManagement;
