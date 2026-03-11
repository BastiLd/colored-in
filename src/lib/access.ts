import { User } from "@supabase/supabase-js";
import { getPlanLimits } from "@/lib/planLimits";

interface AccessInput {
  user: User | null;
  plan?: string | null;
  isActive?: boolean | null;
}

export function deriveAccessState({ user, plan, isActive }: AccessInput) {
  const normalizedPlan = (plan || "free").toLowerCase();
  const paidPlanActive = Boolean(user && isActive && normalizedPlan !== "free");
  const effectivePlan = paidPlanActive ? normalizedPlan : "free";
  const limits = getPlanLimits(effectivePlan);

  return {
    user,
    plan: effectivePlan,
    isActive: paidPlanActive,
    isGuest: !user,
    isFree: effectivePlan === "free",
    isPaid: paidPlanActive,
    canUseProBuilder: paidPlanActive && limits.features.proBuilder,
    canUseAskMode: paidPlanActive && limits.features.askMode,
    canUseAssets: paidPlanActive && (limits.maxImages > 0 || limits.maxLinks > 0),
    canSavePalettes: Boolean(user),
    limits,
  };
}

export type AccessState = ReturnType<typeof deriveAccessState>;
