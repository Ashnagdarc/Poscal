import { useState, useEffect } from 'react';
import { useAuthToken } from '@convex-dev/auth/react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile } from '@/lib/convexProfiles';

export const useAdmin = () => {
  const { user } = useAuth();
  const authToken = useAuthToken();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const profile = await getUserProfile(user, authToken);
        setIsAdmin(profile.role === 'admin' || profile.role === 'super_admin');
      } catch (err) {
        console.error('Error checking admin status:', err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [authToken, user]);

  return { isAdmin, loading };
};
