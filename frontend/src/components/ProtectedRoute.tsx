import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { useAppStore } from "../store/useAppStore";
import { Skeleton } from "./ui/skeleton";

export function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { token, user, bootstrap } = useAppStore();
  const [loading, setLoading] = useState(true);
  const bootstrapRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    
    const initializeAuth = async () => {
      // Only bootstrap once
      if (bootstrapRef.current) {
        setLoading(false);
        return;
      }
      
      bootstrapRef.current = true;
      const hasToken = token || localStorage.getItem("accessToken");
      
      if (hasToken) {
        try {
          await bootstrap();
        } catch (err) {
          console.error("Bootstrap failed:", err);
          // Continue anyway - user might be able to access some pages
        }
      }
      
      if (mounted) {
        setLoading(false);
      }
    };

    initializeAuth();
    
    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array - run only once on mount

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (!token && !localStorage.getItem("accessToken")) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !user?.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
