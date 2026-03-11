import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAccessState } from "@/hooks/useAccessState";

export function RequireAuth() {
  const access = useAccessState();
  const location = useLocation();

  useEffect(() => {
    if (access.isGuest && !access.isLoading) {
      toast.info("Please sign in to continue.");
    }
  }, [access.isGuest, access.isLoading]);

  if (access.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (access.isGuest) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/auth?redirect=${redirect}`} replace />;
  }

  return <Outlet />;
}
