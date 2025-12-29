import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/use-admin";
import { Users, ChevronRight } from "lucide-react";

export const AdminUsersTab = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();

  // Don't render if not admin or still loading admin status
  if (adminLoading || !isAdmin) {
    return null;
  }

  return (
    <button
      onClick={() => navigate('/admin/users')}
      className="w-full bg-secondary rounded-2xl px-4 py-3 flex items-center justify-between transition-all duration-200 active:scale-[0.98]"
    >
      <div className="flex items-center gap-3">
        <Users className="w-5 h-5 text-primary" />
        <span className="font-medium text-foreground">User Management</span>
        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Admin</span>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </button>
  );
};
