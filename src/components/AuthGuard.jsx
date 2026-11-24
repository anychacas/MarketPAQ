import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { createPageUrl } from "@/utils";
import { Loader2 } from 'lucide-react';
import { needsOnboarding, isDeveloper, canPublish } from '@/components/access';
import { canAccessAdminPanel } from '@/components/permissions';

export default function AuthGuard({ children, requiredRoles = null, allowOnboarding = false }) {
  const [state, setState] = useState({ loading: true, user: null, authorized: false });

  useEffect(() => {
    async function check() {
      const currentPath = window.location.pathname;

      // Check authentication
      const isAuth = await api.auth.isAuthenticated();
      if (!isAuth) {
        window.location.href = '/Login';
        return;
      }

      // Get user data with extended fields
      try {
        const { data } = await api.functions.invoke('ensureExtendedUser');
        if (!data || !data.success) {
          window.location.href = '/Login';
          return;
        }

        const user = data.user;

        // Redirect to onboarding if not complete
        if (!allowOnboarding && needsOnboarding(user)) {
          if (!currentPath.includes('/onboarding')) {
            window.location.href = createPageUrl("OnboardingRole");
            return;
          }
        }

        // Check role requirements
        if (requiredRoles) {
          const hasAccess = requiredRoles.some(reqRole => {
            if (reqRole === 'admin') return canAccessAdminPanel(user);
            if (reqRole === 'developer') return isDeveloper(user);
            if (reqRole === 'publisher') return canPublish(user);
            // Exact userType matches (e.g. 'partner', 'partner_leader')
            return reqRole === user.userType;
          });
          if (!hasAccess) {
            setState({ loading: false, user, authorized: false });
            return;
          }
        }

        setState({ loading: false, user, authorized: true });
      } catch (error) {
        console.error('AuthGuard error:', error);
        // If rate limit, retry after a short delay
        if (error.response?.status === 429) {
          setTimeout(() => check(), 2000);
        } else {
          window.location.href = '/Login';
        }
      }
    }
    check();
  }, []);

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!state.authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Acceso restringido</h2>
          <p className="text-slate-500">No tienes permisos para ver esta página.</p>
        </div>
      </div>
    );
  }

  return children;
}
