import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Home, Compass, Palette, Copy, Trash2 } from "lucide-react";
import { PaletteBrowser } from "@/components/PaletteBrowser";
import { PaletteGenerator } from "@/components/PaletteGenerator";
import { ProPaletteBuilder } from "@/components/ProPaletteBuilder";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { UsageContent } from "@/components/UsageContent";
import { PlanContent } from "@/components/PlanContent";
import { toast } from "sonner";

type DashboardView = "home" | "my-palettes" | "explore" | "generator" | "generator-old" | "usage" | "plan";

interface UserProfile {
  email: string | null;
  plan: string;
}

interface SavedPalette {
  id: string;
  name: string;
  colors: string[];
  tags: string[];
  created_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<DashboardView>("home");
  const [generationCount, setGenerationCount] = useState(0);
  const [lastGeneration, setLastGeneration] = useState<string | null>(null);
  const [userPalettes, setUserPalettes] = useState<SavedPalette[]>([]);
  const [loadingPalettes, setLoadingPalettes] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (!session?.user) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      } else {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchUserData = async (userId: string) => {
    try {
      const [profileResult, subscriptionResult, genResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("email")
          .eq("user_id", userId)
          .single(),
        supabase
          .from("user_subscriptions")
          .select("plan")
          .eq("user_id", userId)
          .single(),
        supabase
          .from("user_ai_generations")
          .select("generation_count, last_generation_at")
          .eq("user_id", userId)
          .single(),
      ]);

      setProfile({
        email: profileResult.data?.email ?? user?.email ?? null,
        plan: subscriptionResult.data?.plan ?? "free",
      });

      if (genResult.data) {
        setGenerationCount(genResult.data.generation_count);
        setLastGeneration(genResult.data.last_generation_at);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const handleSelectPalette = (colors: string[]) => {
    setCurrentView("generator");
  };

  const handleViewChange = (view: string) => {
    setCurrentView(view as DashboardView);
    if (view === "my-palettes" && user) {
      fetchUserPalettes(user.id);
    }
  };

  const fetchUserPalettes = async (userId: string) => {
    setLoadingPalettes(true);
    try {
      const { data, error } = await supabase
        .from("public_palettes")
        .select("id, name, colors, tags, created_at")
        .eq("created_by", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUserPalettes(data || []);
    } catch (error) {
      console.error("Error fetching user palettes:", error);
      toast.error("Failed to load palettes");
    } finally {
      setLoadingPalettes(false);
    }
  };

  const deletePalette = async (paletteId: string) => {
    try {
      const { error } = await supabase
        .from("public_palettes")
        .delete()
        .eq("id", paletteId);

      if (error) throw error;
      
      setUserPalettes(prev => prev.filter(p => p.id !== paletteId));
      toast.success("Palette deleted");
    } catch (error) {
      console.error("Error deleting palette:", error);
      toast.error("Failed to delete palette");
    }
  };

  const copyPaletteColors = (colors: string[]) => {
    navigator.clipboard.writeText(colors.join(", "));
    toast.success("Copied all colors!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isPaidPlan = profile?.plan && profile.plan !== "free";

  const renderContent = () => {
    switch (currentView) {
      case "explore":
        return (
          <PaletteBrowser
            onBack={() => setCurrentView("home")}
            onSelectPalette={handleSelectPalette}
          />
        );
      case "generator":
        // Paid plans get the Pro Builder by default
        if (isPaidPlan) {
          return (
            <ProPaletteBuilder
              onBrowse={() => setCurrentView("explore")}
              onHome={() => setCurrentView("home")}
              onOldDesign={() => setCurrentView("generator-old")}
            />
          );
        }
        // Free plan gets the classic generator
        return (
          <PaletteGenerator
            onBrowse={() => setCurrentView("explore")}
            onHome={() => setCurrentView("home")}
          />
        );
      case "generator-old":
        // Old design for paid users who want to switch back
        return (
          <PaletteGenerator
            onBrowse={() => setCurrentView("explore")}
            onHome={() => setCurrentView("home")}
            onNewDesign={() => setCurrentView("generator")}
            showNewDesignButton={true}
          />
        );
      default:
        return null;
    }
  };

  // Render full screen views
  if (currentView === "explore" || currentView === "generator" || currentView === "generator-old") {
    return renderContent();
  }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar 
        profile={profile} 
        currentView={currentView} 
        onViewChange={handleViewChange} 
      />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {currentView === "home" && (
          <div className="p-8">
            {/* Welcome Banner */}
            <div className="relative rounded-2xl overflow-hidden mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/80 via-accent/60 to-pink-500/80"></div>
              <div className="relative p-8 md:p-12">
                <h1 className="text-3xl md:text-4xl font-bold text-white font-display italic mb-4">
                  Let's create something beautiful, {profile?.email?.split("@")[0] ?? "there"}
                </h1>
                <p className="text-white/80 text-lg max-w-xl">
                  Generate stunning color palettes with AI or explore thousands of curated schemes.
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-3 gap-6">
              <button
                onClick={() => setCurrentView("generator")}
                className="p-6 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors text-left group"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Palette className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Generate Palette</h3>
                <p className="text-sm text-muted-foreground">
                  Create a new color palette from scratch or with AI assistance.
                </p>
              </button>

              <button
                onClick={() => setCurrentView("explore")}
                className="p-6 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors text-left group"
              >
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <Compass className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold mb-2">Explore Palettes</h3>
                <p className="text-sm text-muted-foreground">
                  Browse 50,000+ curated color palettes for inspiration.
                </p>
              </button>

              <button
                onClick={() => setCurrentView("my-palettes")}
                className="p-6 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors text-left group"
              >
                <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition-colors">
                  <Home className="h-6 w-6 text-green-500" />
                </div>
                <h3 className="font-semibold mb-2">My Palettes</h3>
                <p className="text-sm text-muted-foreground">
                  View and manage your saved color palettes.
                </p>
              </button>
            </div>
          </div>
        )}

        {currentView === "my-palettes" && (
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">My Palettes</h2>
              <button
                onClick={() => setCurrentView("generator")}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                Create Palette
              </button>
            </div>

            {loadingPalettes ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : userPalettes.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <Palette className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No palettes yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Start creating or saving palettes to see them here.
                </p>
                <button
                  onClick={() => setCurrentView("generator")}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                >
                  Create Palette
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userPalettes.map((palette) => (
                  <div
                    key={palette.id}
                    className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors group"
                  >
                    <div className="flex h-16 rounded-lg overflow-hidden mb-3">
                      {palette.colors.map((color, i) => (
                        <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                    <h3 className="font-medium mb-2 truncate">{palette.name}</h3>
                    <div className="flex gap-1 mb-3 flex-wrap">
                      {palette.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyPaletteColors(palette.colors)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                        Copy
                      </button>
                      <button
                        onClick={() => deletePalette(palette.id)}
                        className="px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentView === "usage" && (
          <UsageContent profile={profile} generationCount={generationCount} />
        )}

        {currentView === "plan" && (
          <PlanContent 
            profile={profile} 
            generationCount={generationCount} 
            lastGeneration={lastGeneration} 
          />
        )}
      </main>
    </div>
  );
};

export default Dashboard;
