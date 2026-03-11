import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap, Crown, Rocket, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAccessState } from "@/hooks/useAccessState";
import { useLanguage } from "@/components/LanguageProvider";

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

function buildPlans(t: (key: string, fallback?: string) => string): Plan[] {
  return [
    {
      name: "Free",
      price: "0",
      period: t("pricing.forever", "forever"),
      description: t("pricing.free.description", "Perfect to get started"),
      icon: <Sparkles className="w-6 h-6" />,
      gradient: "from-slate-500 to-slate-600",
      buttonText: t("pricing.currentPlan", "Current Plan"),
      planKey: "free",
      features: [
        { text: t("pricing.free.feature1", "Manual Generator without account"), included: true },
        { text: t("pricing.free.feature2", "View 500 palettes"), included: true },
        { text: t("pricing.free.feature3", "1 AI palette generation"), included: true },
        { text: t("pricing.free.feature4", "Palette saving"), included: false },
        { text: t("pricing.free.feature5", "Ask Mode"), included: false },
        { text: t("pricing.free.feature6", "Pro Manual Builder with assets"), included: false },
        { text: t("pricing.free.feature7", "Chrome Extension access"), included: false },
      ],
    },
    {
      name: "Pro",
      price: "2.99",
      period: t("pricing.perMonth", "per month"),
      description: t("pricing.pro.description", "For creative minds"),
      icon: <Zap className="w-6 h-6" />,
      gradient: "from-blue-500 to-cyan-500",
      buttonText: t("pricing.getPro", "Get Pro"),
      planKey: "pro",
      features: [
        { text: t("pricing.everythingInFree", "Everything in Free"), included: true },
        { text: t("pricing.pro.feature2", "50 AI palette generations/month"), included: true },
        { text: t("pricing.pro.feature3", "30 Ask Mode messages/month"), included: true },
        { text: t("pricing.pro.feature4", "Pro Manual Builder with assets"), included: true },
        { text: t("pricing.pro.feature5", "View 1,000+ palettes"), included: true },
        { text: t("pricing.pro.feature6", "Save and organize palettes"), included: true },
      ],
    },
    {
      name: "Ultra",
      price: "5.99",
      period: t("pricing.perMonth", "per month"),
      description: t("pricing.ultra.description", "Maximum creativity"),
      icon: <Crown className="w-6 h-6" />,
      gradient: "from-purple-500 to-pink-500",
      popular: true,
      buttonText: t("pricing.getUltra", "Get Ultra"),
      planKey: "ultra",
      features: [
        { text: t("pricing.everythingInPro", "Everything in Pro"), included: true },
        { text: t("pricing.ultra.feature2", "500 AI palette generations/month"), included: true },
        { text: t("pricing.ultra.feature3", "100 Ask Mode chat messages/month"), included: true },
        { text: t("pricing.ultra.feature4", "View 10,000+ palettes"), included: true },
        { text: t("pricing.ultra.feature5", "Chrome Extension"), included: true },
        { text: t("pricing.ultra.feature6", "Save chat history"), included: true },
      ],
    },
    {
      name: "Individual",
      price: "15.99",
      period: t("pricing.perMonth", "per month"),
      description: t("pricing.individual.description", "For pros and agencies"),
      icon: <Rocket className="w-6 h-6" />,
      gradient: "from-amber-500 to-orange-500",
      buttonText: t("pricing.getIndividual", "Get Individual"),
      planKey: "individual",
      features: [
        { text: t("pricing.everythingInUltra", "Everything in Ultra"), included: true },
        { text: t("pricing.individual.feature2", "2,500 AI palette generations/month"), included: true },
        { text: t("pricing.individual.feature3", "300 Ask Mode chat messages/month"), included: true },
        { text: t("pricing.individual.feature4", "View 50,000+ palettes"), included: true },
        { text: t("pricing.individual.feature5", "Priority support"), included: true },
      ],
    },
  ];
}

// Temporary safety switch: checkout is currently blocked by the backend ("Invalid JWT" from Edge Functions).
// We disable paid-plan CTAs until the Supabase auth / Edge Function config is fixed.
const CHECKOUT_ENABLED = true; // Re-enabled for debugging

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
  const { t } = useLanguage();
  
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
          {t("pricing.active", "ACTIVE")}
        </div>
      ) : plan.popular ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
          {t("pricing.popular", "POPULAR")}
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
          <span className="text-4xl font-bold text-foreground">EUR {plan.price}</span>
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
              toast.info(t("pricing.paymentsDisabled", "Payments are temporarily disabled - we're working on it."));
              return;
            }
            onSubscribe(plan.planKey);
          }
        }}
      >
        {isThisLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {t("pricing.processing", "Processing...")}
          </>
        ) : isActive ? (
          t("pricing.currentPlan", "Current Plan")
        ) : plan.planKey === "free" ? (
          isLoggedIn ? t("pricing.freePlan", "Free Plan") : t("pricing.signUpFree", "Sign up free")
        ) : isCheckoutDisabled ? (
          t("pricing.checkoutDisabled", "We are working on it!")
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
  const access = useAccessState();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const plans = useMemo(() => buildPlans(t), [t]);

  useEffect(() => {
    // Check for checkout status from URL
    const checkoutStatus = searchParams.get("checkout");
    if (checkoutStatus === "canceled") {
      toast.info(t("pricing.checkoutCanceled", "Checkout was canceled. You can try again anytime."));
    }
  }, [searchParams, t]);

  const handleSubscribe = async (planKey: string) => {
    // If not logged in, redirect to auth
    if (access.isGuest) {
      toast.info(t("pricing.signInToSubscribe", "Please sign in to subscribe to a plan."));
      navigate("/auth");
      return;
    }

    setIsLoading(true);
    setLoadingPlan(planKey);

    try {
      // Always refresh session to ensure we have the latest valid token
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      
      // If refresh fails, try getSession as fallback
      let activeSession = session;
      if (!activeSession || sessionError) {
        const { data: { session: fallbackSession } } = await supabase.auth.getSession();
        activeSession = fallbackSession;
      }
      
      if (!activeSession) {
        toast.error(t("pricing.signInToContinue", "Please sign in to continue."));
        navigate("/auth");
        return;
      }
      if (!activeSession) {
        toast.error(t("pricing.signInToContinue", "Please sign in to continue."));
        navigate("/auth");
        return;
      }

      // Use Supabase client's invoke method which handles JWT correctly
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          planKey,
          successUrl: `${window.location.origin}${import.meta.env.BASE_URL}dashboard?checkout=success`,
          cancelUrl: `${window.location.origin}${import.meta.env.BASE_URL}pricing?checkout=canceled`,
        },
      });

      if (error) {
        throw error;
      }
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error(t("pricing.checkoutFailed", "Failed to create checkout session."));
      }
    } catch (error) {
      console.error("Subscription error:", error);
      toast.error(t("pricing.error", "Something went wrong. Please try again."));
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
          onClick={() => {
            if (!access.isGuest) {
              navigate("/dashboard");
            } else {
              navigate("/");
            }
          }}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xl font-bold text-gradient font-display">Colored In</span>
        </button>
        <nav className="flex items-center gap-4">
          {!access.isGuest ? (
            <button
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              {t("pricing.dashboard", "Dashboard")}
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate("/auth")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("pricing.signIn", "Sign in")}
              </button>
              <button
                onClick={() => navigate("/auth")}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                {t("pricing.signUp", "Sign up")}
              </button>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <div className="container mx-auto px-6 py-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
          <Crown className="w-4 h-4" />
          <span className="text-sm font-medium">{t("pricing.badge", "Pricing & Plans")}</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 font-display">
          {t("pricing.title", "Choose your plan")}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {t("pricing.subtitle", "Start with the free Manual Generator, then upgrade when you need Pro tools like assets, Ask Mode, saved palettes, and higher limits.")}
        </p>
        <p className="text-sm text-muted-foreground mt-3">
          {t("pricing.note", "Free gives you the normal Manual Generator. Pro unlocks the Pro Manual Builder, assets, Ask Mode, saving, and more usage.")}
        </p>
      </div>

      {/* Plans Grid */}
      <div className="container mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <PlanCard
              key={plan.name}
              plan={plan}
              isActive={access.plan === plan.planKey}
              onSubscribe={handleSubscribe}
              isLoading={isLoading}
              loadingPlan={loadingPlan}
              isLoggedIn={!access.isGuest}
            />
          ))}
        </div>

        {/* FAQ or Note */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground text-sm">
            {t("pricing.vat", "All prices include VAT. Cancel anytime.")}
          </p>
          <p className="text-muted-foreground text-sm mt-2">
            {t("pricing.questions", "Have questions?")}{" "}
            <button className="text-primary hover:underline">{t("pricing.contact", "Contact us")}</button>
          </p>
        </div>
      </div>
    </div>
  );
}
