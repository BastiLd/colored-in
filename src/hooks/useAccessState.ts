import { useCallback, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { deriveAccessState } from "@/lib/access";

type AccessSnapshot = {
  user: User | null;
  plan: string;
  isActive: boolean;
};

const DEFAULT_SNAPSHOT: AccessSnapshot = {
  user: null,
  plan: "free",
  isActive: false,
};

export function useAccessState() {
  const [snapshot, setSnapshot] = useState<AccessSnapshot>(DEFAULT_SNAPSHOT);
  const [isLoading, setIsLoading] = useState(true);

  const loadSnapshot = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      setSnapshot(DEFAULT_SNAPSHOT);
      setIsLoading(false);
      return;
    }

    const { data } = await supabase
      .from("user_subscriptions")
      .select("plan, is_active")
      .eq("user_id", nextUser.id)
      .maybeSingle();

    setSnapshot({
      user: nextUser,
      plan: data?.plan ?? "free",
      isActive: data?.is_active ?? false,
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void loadSnapshot(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      void loadSnapshot(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [loadSnapshot]);

  return {
    ...deriveAccessState(snapshot),
    isLoading,
    refreshAccess: () => loadSnapshot(snapshot.user),
  };
}
