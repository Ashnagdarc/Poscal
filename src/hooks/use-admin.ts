import { useAuth } from "@/contexts/AuthContext";

/**
 * The authenticated viewer query is already reactive and returns the
 * ID-linked profile role. A second token-gated request used to temporarily
 * report non-admin while the auth token refreshed after verification.
 */
export const useAdmin = () => {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  return { isAdmin, loading };
};
