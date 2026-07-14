import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetCurrentUser } from "@workspace/api-client-react";

export function useAuth() {
  const token = localStorage.getItem("psyx_token");
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: user, isLoading, error } = useGetCurrentUser({
    query: { enabled: !!token, retry: false } as any,
  });

  return {
    user: token ? user : null,
    isLoading: !!token && isLoading,
    isAuthenticated: !!user,
    error,
    token,
  };
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, token } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && (!token || (!isAuthenticated && token))) {
      if (!isAuthenticated && token) {
        localStorage.removeItem("psyx_token");
      }
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, token, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
