import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import { useAuth } from "@/contexts/AuthContext";
import { 
  ArrowLeft, 
  Users, 
  Shield, 
  ShieldOff, 
  Trash2, 
  Ban, 
  Loader2, 
  Search, 
  RefreshCw 
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BottomNav } from "@/components/BottomNav";

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  is_banned: boolean;
}

const UserManagement = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: "default" | "destructive";
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const fetchUsers = async () => {
    if (!isSupabaseConfigured || !isAdmin) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_all_users_admin');
      
      if (error) {
        console.error('Error fetching users:', error);
        toast.error("Failed to fetch users");
        return;
      }
      
      setUsers(data || []);
    } catch (err) {
      console.error('Error:', err);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    } else if (!adminLoading && !isAdmin) {
      navigate('/settings');
    }
  }, [isAdmin, adminLoading, navigate]);

  const handlePromoteToAdmin = async (userId: string, userEmail: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Promote to Admin",
      description: `Are you sure you want to make ${userEmail} an admin? They will have full access to manage users and signals.`,
      onConfirm: async () => {
        setActionLoading(userId);
        try {
          const { error } = await supabase
            .from('user_roles')
            .insert({ user_id: userId, role: 'admin' });
          
          if (error) {
            if (error.code === '23505') {
              toast.error("User is already an admin");
            } else {
              throw error;
            }
          } else {
            toast.success(`${userEmail} is now an admin`);
            fetchUsers();
          }
        } catch (err) {
          console.error('Error promoting user:', err);
          toast.error("Failed to promote user");
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleDemoteAdmin = async (userId: string, userEmail: string) => {
    if (userId === currentUser?.id) {
      toast.error("You cannot demote yourself");
      return;
    }
    
    setConfirmDialog({
      isOpen: true,
      title: "Remove Admin Role",
      description: `Are you sure you want to remove admin privileges from ${userEmail}?`,
      variant: "destructive",
      onConfirm: async () => {
        setActionLoading(userId);
        try {
          const { error } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userId)
            .eq('role', 'admin');
          
          if (error) throw error;
          
          toast.success(`${userEmail} is no longer an admin`);
          fetchUsers();
        } catch (err) {
          console.error('Error demoting user:', err);
          toast.error("Failed to demote user");
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleBanUser = async (userId: string, userEmail: string, isBanned: boolean) => {
    if (userId === currentUser?.id) {
      toast.error("You cannot ban yourself");
      return;
    }
    
    setConfirmDialog({
      isOpen: true,
      title: isBanned ? "Unban User" : "Ban User",
      description: isBanned 
        ? `Are you sure you want to unban ${userEmail}? They will be able to access the app again.`
        : `Are you sure you want to ban ${userEmail}? They will no longer be able to access the app.`,
      variant: isBanned ? "default" : "destructive",
      onConfirm: async () => {
        setActionLoading(userId);
        try {
          const { error } = await supabase.rpc('toggle_user_ban', {
            target_user_id: userId,
            ban_status: !isBanned
          });
          
          if (error) throw error;
          
          toast.success(isBanned ? `${userEmail} has been unbanned` : `${userEmail} has been banned`);
          fetchUsers();
        } catch (err) {
          console.error('Error toggling ban:', err);
          toast.error("Failed to update ban status");
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (userId === currentUser?.id) {
      toast.error("You cannot delete yourself");
      return;
    }
    
    setConfirmDialog({
      isOpen: true,
      title: "Delete User",
      description: `Are you sure you want to permanently delete ${userEmail}? This action cannot be undone.`,
      variant: "destructive",
      onConfirm: async () => {
        setActionLoading(userId);
        try {
          const { error } = await supabase.rpc('delete_user_admin', {
            target_user_id: userId
          });
          
          if (error) throw error;
          
          toast.success(`${userEmail} has been deleted`);
          fetchUsers();
        } catch (err) {
          console.error('Error deleting user:', err);
          toast.error("Failed to delete user");
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* Header */}
      <header className="pt-12 pb-4 px-6 flex items-center gap-3 animate-fade-in">
        <button
          onClick={() => navigate('/settings')}
          className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        </div>
        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Admin</span>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-4 space-y-4 animate-slide-up">
        {/* Search and Refresh */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-10 pr-4 bg-secondary rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center transition-all hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats */}
        <div className="bg-secondary rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-foreground">{users.length}</p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{users.filter(u => u.is_admin).length}</p>
              <p className="text-xs text-muted-foreground">Admins</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{users.filter(u => u.is_banned).length}</p>
              <p className="text-xs text-muted-foreground">Banned</p>
            </div>
          </div>
        </div>
        
        {/* Users List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-secondary rounded-2xl p-8 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No users found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className={`bg-secondary rounded-2xl p-4 space-y-3 ${user.is_banned ? 'opacity-60 border border-destructive/30' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground truncate">{user.email}</p>
                      {user.is_admin && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Admin</span>
                      )}
                      {user.is_banned && (
                        <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded-full">Banned</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Joined: {formatDate(user.created_at)} • Last login: {formatDate(user.last_sign_in_at)}
                    </p>
                  </div>
                  {user.id === currentUser?.id && (
                    <span className="text-xs bg-foreground/10 text-muted-foreground px-2 py-1 rounded-full">You</span>
                  )}
                </div>
                
                {/* Action Buttons */}
                {user.id !== currentUser?.id && (
                  <div className="flex gap-2">
                    {user.is_admin ? (
                      <button
                        onClick={() => handleDemoteAdmin(user.id, user.email)}
                        disabled={actionLoading === user.id}
                        className="flex-1 h-10 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all hover:bg-amber-500/30 disabled:opacity-50"
                      >
                        {actionLoading === user.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ShieldOff className="w-4 h-4" />
                        )}
                        Demote
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePromoteToAdmin(user.id, user.email)}
                        disabled={actionLoading === user.id}
                        className="flex-1 h-10 bg-primary/20 text-primary rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all hover:bg-primary/30 disabled:opacity-50"
                      >
                        {actionLoading === user.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Shield className="w-4 h-4" />
                        )}
                        Make Admin
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleBanUser(user.id, user.email, user.is_banned)}
                      disabled={actionLoading === user.id}
                      className={`flex-1 h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                        user.is_banned 
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30' 
                          : 'bg-orange-500/20 text-orange-600 dark:text-orange-400 hover:bg-orange-500/30'
                      }`}
                    >
                      {actionLoading === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Ban className="w-4 h-4" />
                      )}
                      {user.is_banned ? 'Unban' : 'Ban'}
                    </button>
                    
                    <button
                      onClick={() => handleDeleteUser(user.id, user.email)}
                      disabled={actionLoading === user.id}
                      className="flex-1 h-10 bg-destructive/20 text-destructive rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all hover:bg-destructive/30 disabled:opacity-50"
                    >
                      {actionLoading === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmText="Confirm"
        cancelText="Cancel"
      />
      
      <BottomNav />
    </div>
  );
};

export default UserManagement;
