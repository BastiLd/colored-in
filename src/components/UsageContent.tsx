import { Sparkles, Image, Palette, Wand2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface UsageData {
  name: string;
  value: number;
  color: string;
  icon: React.ReactNode;
  limit: number | null;
}

interface UsageContentProps {
  profile: {
    email: string | null;
    plan: string;
  } | null;
  generationCount: number;
}

const planLimits: Record<string, number | null> = {
  free: 1,
  pro: 100,
  ultra: 500,
  individual: null,
};

export const UsageContent = ({ profile, generationCount }: UsageContentProps) => {
  const userPlan = profile?.plan ?? "free";
  const totalLimit = planLimits[userPlan];
  const totalUsed = generationCount;

  // Simulate different usage types
  const imageTopalette = Math.floor(totalUsed * 0.4);
  const colorRecognition = Math.floor(totalUsed * 0.25);
  const aiPrompt = Math.floor(totalUsed * 0.35);

  const usageData: UsageData[] = [
    {
      name: "Image to Palette",
      value: imageTopalette,
      color: "hsl(221, 83%, 53%)",
      icon: <Image className="w-5 h-5" />,
      limit: totalLimit ? Math.floor(totalLimit * 0.4) : null,
    },
    {
      name: "Color Recognition",
      value: colorRecognition,
      color: "hsl(25, 95%, 53%)",
      icon: <Palette className="w-5 h-5" />,
      limit: totalLimit ? Math.floor(totalLimit * 0.25) : null,
    },
    {
      name: "AI Prompt",
      value: aiPrompt,
      color: "hsl(280, 87%, 65%)",
      icon: <Wand2 className="w-5 h-5" />,
      limit: totalLimit ? Math.floor(totalLimit * 0.35) : null,
    },
  ];

  const pieData = usageData.filter(d => d.value > 0);

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Usage</h1>
        <p className="text-muted-foreground mb-8">
          Overview of your AI palette generations
        </p>

        {/* Total Usage Card */}
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Total Generations</h2>
              <p className="text-sm text-muted-foreground capitalize">{userPlan} Plan</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-3xl font-bold">
                {totalUsed}
                <span className="text-lg text-muted-foreground font-normal">
                  {" "}/ {totalLimit === null ? "∞" : totalLimit}
                </span>
              </p>
            </div>
          </div>

          {/* Main Progress Bar */}
          {totalLimit !== null ? (
            <div className="relative h-4 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-accent to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (totalUsed / totalLimit) * 100)}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-lg border-2 border-primary transition-all duration-500"
                style={{ left: `calc(${Math.min(100, (totalUsed / totalLimit) * 100)}% - 10px)` }}
              />
            </div>
          ) : (
            <div className="relative h-4 bg-gradient-to-r from-primary/20 via-accent/20 to-pink-500/20 rounded-full flex items-center justify-center">
              <span className="text-xs text-primary font-semibold">UNLIMITED</span>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Pie Chart */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4">Usage Distribution</h3>
            {pieData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                      labelStyle={{
                        color: "hsl(var(--foreground))",
                      }}
                      itemStyle={{
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Legend 
                      wrapperStyle={{
                        color: "hsl(var(--foreground))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No usage data yet
              </div>
            )}
          </div>

          {/* Individual Sliders */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-6">Details by Type</h3>
            <div className="space-y-6">
              {usageData.map((item, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${item.color}20`, color: item.color }}
                      >
                        {item.icon}
                      </div>
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {item.value} {item.limit !== null ? `/ ${item.limit}` : ""}
                    </span>
                  </div>
                  <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                      style={{
                        width: item.limit !== null
                          ? `${Math.min(100, (item.value / item.limit) * 100)}%`
                          : `${Math.min(100, item.value)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md border-2 transition-all duration-500"
                      style={{
                        left: item.limit !== null
                          ? `calc(${Math.min(100, (item.value / item.limit) * 100)}% - 8px)`
                          : `calc(${Math.min(100, item.value)}% - 8px)`,
                        borderColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Plan Limits Info */}
        <div className="mt-8 p-6 bg-muted/50 rounded-xl">
          <h3 className="font-semibold mb-4">AI Generation Limits by Plan</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "Free", limit: "1", active: userPlan === "free" },
              { name: "Pro", limit: "100", active: userPlan === "pro" },
              { name: "Ultra", limit: "500", active: userPlan === "ultra" },
              { name: "Individual", limit: "∞", active: userPlan === "individual" },
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
                <p className={`text-xl font-bold ${plan.active ? "text-primary" : ""}`}>
                  {plan.limit}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
