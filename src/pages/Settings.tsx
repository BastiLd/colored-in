import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { ArrowLeft, Shield, Lock, Eye, EyeOff, Trash2, AlertTriangle, CreditCard, Crown, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SubscriptionData {
  plan: string;
  is_active: boolean;
  expires_at: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
}

const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  ultra: "Ultra",
  individual: "Individual",
};

const Settings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);

  useEffect(() => {
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (!session?.user) {
          navigate("/auth");
        }
      }
    );

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
        return;
      }

      // Fetch subscription data
      const { data: subData } = await supabase
        .from("user_subscriptions")
        .select("plan, is_active, expires_at, stripe_subscription_id, stripe_customer_id")
        .eq("user_id", session.user.id)
        .single();

      if (subData) {
        setSubscription(subData);
      }

      setLoading(false);
    };

    init();

    return () => authSubscription.unsubscribe();
  }, [navigate]);

  const handleManageBilling = async () => {
    if (!subscription?.stripe_customer_id) {
      toast.error("No billing information found.");
      return;
    }

    setIsLoadingPortal(true);
    try {
      // For now, we'll provide a direct link to Stripe's billing portal
      // In production, you'd create a portal session via Edge Function
      toast.info("Billing management is available through Stripe. Contact support for assistance.");
    } catch (error) {
      console.error("Error opening billing portal:", error);
      toast.error("Failed to open billing portal.");
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription?.stripe_subscription_id) {
      toast.error("No active subscription to cancel.");
      return;
    }

    setIsCanceling(true);
    try {
      // In a full implementation, you'd call an Edge Function to cancel the subscription
      // For now, we'll show an info message
      toast.info("To cancel your subscription, please contact support or manage it through the billing portal.");
    } catch (error) {
      console.error("Error canceling subscription:", error);
      toast.error("Failed to cancel subscription.");
    } finally {
      setIsCanceling(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setIsUpdating(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    
    try {
      // Call the RPC function to delete current user
      const { error } = await supabase.rpc('delete_current_user');

      if (error) {
        throw error;
      }

      // Sign out (user is already deleted at this point)
      await supabase.auth.signOut();
      
      toast.success("Account successfully deleted. You can now register again with the same email.");
      navigate("/auth");
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error(error.message || "Failed to delete account.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-border">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-3 p-2 -ml-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
          <h1 className="text-xl font-bold">Safety Settings</h1>
        </button>
      </header>

      <main className="container max-w-2xl mx-auto px-6 py-8">
        {/* Security Section */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Security</h2>
              <p className="text-sm text-muted-foreground">Manage your account security</p>
            </div>
          </div>

          {/* Change Password */}
          <div className="border-t border-border pt-6">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-medium">Change Password</h3>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={isUpdating || !newPassword || !confirmPassword}>
                {isUpdating ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </div>
        </div>

        {/* Account Info */}
        <div className="mt-6 bg-card border border-border rounded-xl p-6">
          <h3 className="font-medium mb-4">Account Information</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Account Created</span>
              <span className="text-sm font-medium">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Subscription Management */}
        <div className="mt-6 bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Subscription</h2>
              <p className="text-sm text-muted-foreground">Manage your subscription and billing</p>
            </div>
          </div>

          <div className="border-t border-border pt-6 space-y-4">
            {/* Current Plan */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 text-amber-500" />
                <div>
                  <span className="text-sm text-muted-foreground">Current Plan</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {PLAN_NAMES[subscription?.plan || "free"]}
                    </span>
                    {subscription?.is_active && subscription?.plan !== "free" && (
                      <Badge variant="default" className="bg-green-500">Active</Badge>
                    )}
                    {!subscription?.is_active && subscription?.plan !== "free" && (
                      <Badge variant="destructive">Inactive</Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/pricing")}
              >
                {subscription?.plan === "free" ? "Upgrade" : "Change Plan"}
              </Button>
            </div>

            {/* Next Billing Date */}
            {subscription?.expires_at && subscription?.plan !== "free" && (
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div>
                  <span className="text-sm text-muted-foreground">Next Billing Date</span>
                  <p className="font-medium">
                    {new Date(subscription.expires_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            )}

            {/* Billing Management */}
            {subscription?.stripe_customer_id && subscription?.plan !== "free" && (
              <div className="flex flex-wrap gap-3 pt-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManageBilling}
                  disabled={isLoadingPortal}
                >
                  {isLoadingPortal ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Manage Billing
                    </>
                  )}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      disabled={isCanceling}
                    >
                      Cancel Subscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel your subscription? You'll lose access to:
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Premium palette browsing</li>
                          <li>AI generation credits</li>
                          <li>Advanced features</li>
                        </ul>
                        Your subscription will remain active until {subscription?.expires_at ? new Date(subscription.expires_at).toLocaleDateString() : "the end of your billing period"}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancelSubscription}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        {isCanceling ? "Canceling..." : "Yes, Cancel"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* Upgrade CTA for free users */}
            {(!subscription || subscription?.plan === "free") && (
              <div className="pt-3 border-t border-border">
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Upgrade to unlock unlimited AI generations, premium palettes, and more.
                  </p>
                  <Button onClick={() => navigate("/pricing")} size="sm">
                    View Plans
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mt-6 bg-card border-2 border-red-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h3 className="font-semibold text-red-500">Danger Zone</h3>
              <p className="text-sm text-muted-foreground">Irreversible actions</p>
            </div>
          </div>

          <div className="border-t border-red-500/20 pt-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium mb-1">Delete Account</h4>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    className="ml-4"
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your account
                      and remove all your data including:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Your profile information</li>
                        <li>All saved palettes</li>
                        <li>Your subscription data</li>
                        <li>AI generation history</li>
                      </ul>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      {isDeleting ? "Deleting..." : "Yes, delete my account"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
