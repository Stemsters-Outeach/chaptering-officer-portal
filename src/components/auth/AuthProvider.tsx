import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom"; 
import { supabase } from "../../lib/supabase"; 

export default function AuthGuard({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate(); 

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
      } else {
        setAuthenticated(true);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!session) {
        navigate("/login"); 
      } else {
        setAuthenticated(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (!authenticated) {
    return <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Checking authentication...</div>;
  }

  return <>{children}</>;
}