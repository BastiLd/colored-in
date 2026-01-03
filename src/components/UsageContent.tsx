import { MessageCircle, Sparkles } from "lucide-react";
import { getPlanLimits } from "@/lib/planLimits";

interface UsageContentProps {
  profile: {
    email: string | null;
    plan: string;
  } | null;
  generationCount: number;
  chatUsageCount: number;
}

export const UsageContent = ({ profile, generationCount, chatUsageCount }: UsageContentProps) => {
  const userPlan = profile?.plan ?? "free";
  const limits = getPlanLimits(userPlan);
  const paletteLimit = limits.palettesPerMonth;
  const chatLimit = limits.chatMessagesPerMonth;

  const paletteUsed = generationCount;
  const chatUsed = chatUsageCount;

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Usage</h1>
        <p className="text-muted-foreground mb-8">
          Overview of your monthly AI usage
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* AI Palettes */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">AI Palettes</h2>
                <p className="text-sm text-muted-foreground capitalize">{userPlan} plan</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-3xl font-bold">
                  {paletteUsed}
                  <span className="text-lg text-muted-foreground font-normal">
                    {" "}/ {paletteLimit === Infinity ? "∞" : paletteLimit}
                  </span>
                </p>
              </div>
            </div>

            <div className="relative h-4 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-accent to-pink-500 rounded-full transition-all duration-500"
                style={{
                  width:
                    paletteLimit === Infinity
                      ? "100%"
                      : `${Math.min(100, (paletteUsed / Math.max(1, paletteLimit)) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Ask Mode Chat */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Ask Mode Chat</h2>
                <p className="text-sm text-muted-foreground">
                  {limits.features.askMode ? "Enabled" : "Upgrade required"}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-3xl font-bold">
                  {chatUsed}
                  <span className="text-lg text-muted-foreground font-normal">
                    {" "}/ {chatLimit === Infinity ? "∞" : chatLimit}
                  </span>
                </p>
              </div>
            </div>

            <div className="relative h-4 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-accent to-pink-500 rounded-full transition-all duration-500"
                style={{
                  width:
                    chatLimit === Infinity
                      ? "100%"
                      : `${Math.min(100, (chatUsed / Math.max(1, chatLimit)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Plan Limits Info */}
        <div className="mt-8 p-6 bg-muted/50 rounded-xl">
          <h3 className="font-semibold mb-4">Monthly limits by plan</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "Free", limit: "1 palette / 0 chat", active: userPlan === "free" },
              { name: "Pro", limit: "50 palettes / 30 chat", active: userPlan === "pro" },
              { name: "Ultra", limit: "500 palettes / 100 chat", active: userPlan === "ultra" },
              { name: "Individual", limit: "2500 palettes / 300 chat", active: userPlan === "individual" },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`p-4 rounded-lg text-center ${
                  plan.active
                    ? "bg-primary/10 border-2 border-primary"
                    : "bg-background border border-border"
                }`}
              >
                <p className="text-sm text-muted-foreground">{plan.name}</p>
                <p className={`text-sm font-semibold ${plan.active ? "text-primary" : ""}`}>{plan.limit}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
