import { useAuthStore } from '@shared/stores/authStore';

/** Hook conveniente para acessar auth state — padrão igual à web */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const loading = useAuthStore((s) => s.loading);
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  return { user, profile, loading, isAdmin, isAuthenticated };
}
