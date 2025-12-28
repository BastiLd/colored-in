import { Check, Sparkles, Zap, Crown, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface PlanInfo {
  name: string;
  key: string;
  icon: React.ReactNode;
  gradient: string;
  palettes: string;
  aiGenerations: string;
}

const plans: PlanInfo[] = [
  {
    name: "Free",
    key: "free",
    icon: <Sparkles className="w-5 h-5" />,
    gradient: "from-slate-500 to-slate-600",
    palettes: "500 Palettes",
    aiGenerations: "1 Generation",
  },
  {
    name: "Pro",
    key: "pro",
    icon: <Zap className="w-5 h-5" />,
    gradient: "from-blue-500 to-cyan-500",
    palettes: "1,000+ Palettes",
    aiGenerations: "100 Generations",
  },
  {
    name: "Ultra",
    key: "ultra",
    icon: <Crown className="w-5 h-5" />,
    gradient: "from-purple-500 to-pink-500",
    palettes: "10,000+ Palettes",
    aiGenerations: "500 Generations",
  },
  {
    name: "Individual",
    key: "individual",
    icon: <Rocket className="w-5 h-5" />,
    gradient: "from-amber-500 to-orange-500",
    palettes: "50,000 Palettes",
    aiGenerations: "Unlimited",
  },
];

interface PlanContentProps {
  profile: {
    email: string | null;
    plan: string;
  } | null;
  generationCount: number;
  lastGeneration: string | null;
}

export const PlanContent = ({ profile, generationCount, lastGeneration }: PlanContentProps) => {
  const navigate = useNavigate();
  const userPlan = profile?.plan ?? "free";
  const currentPlanInfo = plans.find((p) => p.key === userPlan);
  const showSummary = userPlan === "ultra" || userPlan === "individual";

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Your Plan</h1>
        <p className="text-muted-foreground mb-8">
          Manage your subscription and view all available plans
        </p>

        {/* Current Plan */}
        {currentPlanInfo && (
          <div className="bg-card border-2 border-primary rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${currentPlanInfo.gradient} flex items-center justify-center text-white`}
                >
                  {currentPlanInfo.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{currentPlanInfo.name}</h2>
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-500 rounded-full">
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-muted-foreground">Your current plan</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Access to</p>
                <p className="font-semibold">{currentPlanInfo.palettes}</p>
              </div>
            </div>
          </div>
        )}

        {/* Usage Summary - Only for Ultra and Individual */}
        {showSummary && (
          <div className="bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 rounded-xl p-6 mb-8">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              Usage Summary
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">AI Generations</p>
                <p className="text-2xl font-bold">{generationCount}</p>
              </div>
              <div className="bg-background/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Last Activity</p>
                <p className="text-lg font-medium">
                  {lastGeneration
                    ? new Date(lastGeneration).toLocaleDateString("en-US")
                    : "None yet"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* All Plans */}
        <h3 className="text-lg font-semibold mb-4">All Plans</h3>
        <div className="space-y-3">
          {plans.map((plan) => {
            const isActive = plan.key === userPlan;
            return (
              <div
                key={plan.key}
                className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg bg-gradient-to-br ${plan.gradient} flex items-center justify-center text-white`}
                  >
                    {plan.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{plan.name}</span>
                      {isActive && (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {plan.palettes} • {plan.aiGenerations}
                    </p>
                  </div>
                </div>
                {!isActive && plan.key !== "free" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/pricing")}
                  >
                    Upgrade
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Manage Button */}
        <div className="mt-8 text-center">
          <Button variant="outline" onClick={() => navigate("/pricing")}>
            Compare all plans
          </Button>
        </div>
      </div>
    </div>
  );
};
