import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap, Crown, Rocket, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  price: string;
  period: string;
  description: string;
  icon: React.ReactNode;
  features: PlanFeature[];
  popular?: boolean;
  buttonText: string;
  gradient: string;
  planKey: string;
}

const plans: Plan[] = [
  {
    name: "Free",
    price: "0",
    period: "forever",
    description: "Perfect to get started",
    icon: <Sparkles className="w-6 h-6" />,
    gradient: "from-slate-500 to-slate-600",
    buttonText: "Current Plan",
    planKey: "free",
    features: [
      { text: "View 500 palettes", included: true },
      { text: "1x free AI generation", included: true },
      { text: "Basic manual generator", included: true },
      { text: "Unlimited AI generation", included: false },
      { text: "Chrome Extension", included: false },
      { text: "Custom palette editor", included: false },
    ],
  },
  {
    name: "Pro",
    price: "2.99",
    period: "per month",
    description: "For creative minds",
    icon: <Zap className="w-6 h-6" />,
    gradient: "from-blue-500 to-cyan-500",
    buttonText: "Get Pro",
    planKey: "pro",
    features: [
      { text: "Everything in Free", included: true },
      { text: "100 AI palette generations", included: true },
      { text: "View all 1,000+ palettes", included: true },
      { text: "Save & organize palettes", included: true },
      { text: "Chrome Extension", included: false },
      { text: "CSS code export", included: false },
    ],
  },
  {
    name: "Ultra",
    price: "5.99",
    period: "per month",
    description: "Maximum creativity",
    icon: <Crown className="w-6 h-6" />,
    gradient: "from-purple-500 to-pink-500",
    popular: true,
    buttonText: "Get Ultra",
    planKey: "ultra",
    features: [
      { text: "Everything in Pro", included: true },
      { text: "500 AI generations", included: true },
      { text: "View 10,000+ palettes", included: true },
      { text: "Chrome Extension everywhere", included: true },
      { text: "Notes for palettes", included: true },
      { text: "Custom palette editor", included: true },
    ],
  },
  {
    name: "Individual",
    price: "15.99",
    period: "per month",
    description: "For pros & agencies",
    icon: <Rocket className="w-6 h-6" />,
    gradient: "from-amber-500 to-orange-500",
    buttonText: "Get Individual",
    planKey: "individual",
    features: [
      { text: "Everything in Ultra", included: true },
      { text: "Unlimited AI generations", included: true },
      { text: "View all 50,000 palettes", included: true },
      { text: "Auto-generate CSS code", included: true },
      { text: "Unlimited projects", included: true },
      { text: "Priority support", included: true },
    ],
  },
];

// Temporary safety switch: checkout is currently blocked by the backend ("Invalid JWT" from Edge Functions).
// We disable paid-plan CTAs until the Supabase auth / Edge Function config is fixed.
const CHECKOUT_ENABLED = false;

interface PlanCardProps {
  plan: Plan;
  isActive: boolean;
  onSubscribe: (planKey: string) => void;
  isLoading: boolean;
  loadingPlan: string | null;
  isLoggedIn: boolean;
}

function PlanCard({ plan, isActive, onSubscribe, isLoading, loadingPlan, isLoggedIn }: PlanCardProps) {
  const isThisLoading = isLoading && loadingPlan === plan.planKey;
  const isCheckoutDisabled = !CHECKOUT_ENABLED && plan.planKey !== "free" && !isActive;
  const isDisabled = isActive || isCheckoutDisabled || (isLoading && loadingPlan !== plan.planKey);
  
  return (
    <div
      className={`relative rounded-2xl border ${
        isActive
          ? "border-green-500 shadow-lg shadow-green-500/20"
          : plan.popular
          ? "border-primary shadow-2xl shadow-primary/20 scale-105"
          : "border-border"
      } bg-card p-6 flex flex-col transition-all hover:shadow-xl`}
    >
      {isActive ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-green-500 text-white text-xs font-bold">
          ACTIVE
        </div>
      ) : plan.popular ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
          POPULAR
        </div>
      ) : null}

      {/* Header */}
      <div className="text-center mb-6">
        <div
          className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} text-white mb-4`}
        >
          {plan.icon}
        </div>
        <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
        <p className="text-sm text-muted-foreground">{plan.description}</p>
      </div>

      {/* Price */}
      <div className="text-center mb-6">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold text-foreground">€{plan.price}</span>
          <span className="text-muted-foreground">/{plan.period}</span>
        </div>
      </div>

      {/* Features */}
      <div className="flex-1 space-y-3 mb-6">
        {plan.features.map((feature, i) => (
          <div key={i} className="flex items-start gap-3">
            <div
              className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                feature.included
                  ? "bg-green-500/20 text-green-500"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {feature.included ? (
                <Check className="w-3 h-3" />
              ) : (
                <span className="w-1.5 h-0.5 bg-current rounded" />
              )}
            </div>
            <span
              className={`text-sm ${
                feature.included ? "text-foreground" : "text-muted-foreground line-through"
              }`}
            >
              {feature.text}
            </span>
          </div>
        ))}
      </div>

      {/* Button */}
      <Button
        className={`w-full ${
          isActive
            ? "bg-green-500 hover:bg-green-600"
            : plan.popular
            ? "bg-gradient-to-r from-primary to-primary/80"
            : ""
        }`}
        variant={isActive ? "default" : plan.planKey === "free" ? "secondary" : "default"}
        disabled={isDisabled || plan.planKey === "free"}
        onClick={() => {
          if (!isActive && plan.planKey !== "free") {
            if (isCheckoutDisabled) {
              toast.info("Payments are temporarily disabled — we’re working on it.");
              return;
            }
            onSubscribe(plan.planKey);
          }
        }}
      >
        {isThisLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : isActive ? (
          "Current Plan"
        ) : plan.planKey === "free" ? (
          isLoggedIn ? "Free Plan" : "Sign up free"
        ) : isCheckoutDisabled ? (
          "We are working on it!"
        ) : (
          plan.buttonText
        )}
      </Button>
    </div>
  );
}

export default function Pricing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [userPlan, setUserPlan] = useState<string>("free");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsLoggedIn(true);
        const { data: subscriptionData } = await supabase
          .from("user_subscriptions")
          .select("plan")
          .eq("user_id", session.user.id)
          .single();
        
        if (subscriptionData?.plan) {
          setUserPlan(subscriptionData.plan);
        } else {
          setUserPlan("free");
        }
      } else {
        setUserPlan("free");
      }
    };
    checkUser();

    // Check for checkout status from URL
    const checkoutStatus = searchParams.get("checkout");
    if (checkoutStatus === "canceled") {
      toast.info("Checkout was canceled. You can try again anytime.");
    }
  }, [searchParams]);

  const handleSubscribe = async (planKey: string) => {
    // If not logged in, redirect to auth
    if (!isLoggedIn) {
      toast.info("Please sign in to subscribe to a plan.");
      navigate("/auth");
      return;
    }

    setIsLoading(true);
    setLoadingPlan(planKey);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please sign in to continue.");
        navigate("/auth");
        return;
      }

      toast.info("Payments are temporarily disabled — we’re working on it.");
      return;
    } catch (error) {
      console.error("Subscription error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xl font-bold text-gradient font-display">Colored In</span>
        </button>
        <nav className="flex items-center gap-4">
          {isLoggedIn ? (
            <button
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              Dashboard
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate("/auth")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in
              </button>
              <button
                onClick={() => navigate("/auth")}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                Sign up
              </button>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <div className="container mx-auto px-6 py-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
          <Crown className="w-4 h-4" />
          <span className="text-sm font-medium">Pricing & Plans</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 font-display">
          Choose your plan
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          From free palettes to professional tools - find the perfect plan for
          your creative needs.
        </p>
      </div>

      {/* Plans Grid */}
      <div className="container mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <PlanCard
              key={plan.name}
              plan={plan}
              isActive={userPlan === plan.planKey}
              onSubscribe={handleSubscribe}
              isLoading={isLoading}
              loadingPlan={loadingPlan}
              isLoggedIn={isLoggedIn}
            />
          ))}
        </div>

        {/* FAQ or Note */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground text-sm">
            All prices include VAT. Cancel anytime.
          </p>
          <p className="text-muted-foreground text-sm mt-2">
            Have questions?{" "}
            <button className="text-primary hover:underline">Contact us</button>
          </p>
        </div>
      </div>
    </div>
  );
}
