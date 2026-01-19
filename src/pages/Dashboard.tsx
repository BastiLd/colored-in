import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getStoragePathFromUrl, USER_ASSETS_BUCKET } from "@/lib/storage";
import { User } from "@supabase/supabase-js";
import { Home, Compass, Palette, Copy, Trash2, Sparkles, Upload, Link as LinkIcon, ExternalLink, Loader2, Image } from "lucide-react";
import { PaletteBrowser } from "@/components/PaletteBrowser";
import { PaletteGenerator } from "@/components/PaletteGenerator";
import { ProPaletteBuilder } from "@/components/ProPaletteBuilder";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { UsageContent } from "@/components/UsageContent";
import { PlanContent } from "@/components/PlanContent";
import { AIPaletteGenerator } from "@/components/AIPaletteGenerator";
import { PaletteDetailModal } from "@/components/PaletteDetailModal";
import { getPlanLimits } from "@/lib/planLimits";
import { toast } from "sonner";
import { GuidedTour, type TourStep } from "@/components/GuidedTour";
import { useMemo } from "react";

type DashboardView = "home" | "my-palettes" | "uploads" | "generator" | "generator-old" | "usage" | "plan";

interface UserProfile {
  email: string | null;
  plan: string;
  is_active?: boolean;
}

interface SavedPalette {
  id: string;
  name: string;
  colors: string[];
  tags: string[];
  created_at: string;
  description?: string | null;
  color_descriptions?: string[] | null;
}

interface UserAsset {
  id: string;
  type: "image" | "link";
  url: string;
  filename: string | null;
  created_at: string;
  displayUrl?: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<DashboardView>("home");
  const [generationCount, setGenerationCount] = useState(0);
  const [lastGeneration, setLastGeneration] = useState<string | null>(null);
  const [userPalettes, setUserPalettes] = useState<SavedPalette[]>([]);
  const [loadingPalettes, setLoadingPalettes] = useState(false);
  const [chatUsageCount, setChatUsageCount] = useState(0);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [userAssets, setUserAssets] = useState<UserAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [selectedPalette, setSelectedPalette] = useState<SavedPalette | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const initialView = params.get("view") as DashboardView | null;
    if (initialView) {
      setCurrentView(initialView);
    }

    // Check for checkout success
    const checkoutStatus = params.get("checkout");
    if (checkoutStatus === "success") {
      toast.success("Welcome to your new plan! 🎉");
      // Refresh user data to get updated subscription
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          fetchUserData(session.user.id);
        }
      });
    }

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
        const viewToLoad = initialView || currentView;
        if (viewToLoad === "my-palettes") {
          fetchUserPalettes(session.user.id);
        } else if (viewToLoad === "uploads") {
          fetchUserAssets(session.user.id);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.search]);

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
          .select("plan, is_active")
          .eq("user_id", userId)
          .single(),
        supabase
          .from("user_ai_usage")
          .select("palette_generations_count, last_generation_at, chat_messages_count")
          .eq("user_id", userId)
          .single(),
      ]);

      setProfile({
        email: profileResult.data?.email ?? user?.email ?? null,
        plan: subscriptionResult.data?.plan ?? "free",
        is_active: subscriptionResult.data?.is_active ?? false,
      });

      if (genResult.data) {
        setGenerationCount(genResult.data.palette_generations_count || 0);
        setLastGeneration(genResult.data.last_generation_at);
        setChatUsageCount(genResult.data.chat_messages_count || 0);
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
    } else if (view === "uploads" && user) {
      fetchUserAssets(user.id);
    }
  };

  const resolveAssetUrls = async (items: UserAsset[]) => {
    const resolved = await Promise.all(
      items.map(async (asset) => {
        if (asset.type !== "image") return asset;
        if (asset.url.startsWith("data:") || asset.url.startsWith("blob:")) {
          return { ...asset, displayUrl: asset.url };
        }
        if (asset.url.includes("/storage/v1/object/sign/")) {
          return { ...asset, displayUrl: asset.url };
        }
        const path = getStoragePathFromUrl(asset.url);
        if (!path) {
          return { ...asset, displayUrl: asset.url };
        }
        const { data, error } = await supabase.storage
          .from(USER_ASSETS_BUCKET)
          .createSignedUrl(path, 60 * 60);
        if (!error && data?.signedUrl) {
          return { ...asset, displayUrl: data.signedUrl };
        }
        const { data: publicData } = supabase.storage
          .from(USER_ASSETS_BUCKET)
          .getPublicUrl(path);
        if (publicData?.publicUrl) {
          return { ...asset, displayUrl: publicData.publicUrl };
        }
        return { ...asset, displayUrl: asset.url };
      })
    );
    setUserAssets(resolved);
  };

  const fetchUserAssets = async (userId: string) => {
    setLoadingAssets(true);
    try {
      const { data, error } = await supabase
        .from("user_assets")
        .select("id, type, url, filename, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      await resolveAssetUrls((data as UserAsset[]) || []);
    } catch (error) {
      console.error("Error fetching user assets:", error);
      toast.error("Failed to load uploads");
    } finally {
      setLoadingAssets(false);
    }
  };

  const deleteAsset = async (assetId: string, assetUrl: string, type: string) => {
    try {
      // Delete from storage if it's an image
      if (type === "image") {
        const path = getStoragePathFromUrl(assetUrl);
        if (path) {
          await supabase.storage.from(USER_ASSETS_BUCKET).remove([path]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from("user_assets")
        .delete()
        .eq("id", assetId);

      if (error) throw error;
      
      setUserAssets(prev => prev.filter(a => a.id !== assetId));
      toast.success("Upload deleted");
    } catch (error) {
      console.error("Error deleting asset:", error);
      toast.error("Failed to delete upload");
    }
  };

  const fetchUserPalettes = async (userId: string) => {
    setLoadingPalettes(true);
    try {
      const { data, error } = await supabase
        .from("public_palettes")
        .select("id, name, colors, tags, created_at, description, color_descriptions")
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

  const dashboardTourSteps = useMemo<TourStep[]>(
    () => [
      {
        id: "sidebar",
        selector: '[data-tour="dashboard-sidebar"]',
        title: "Navigation Sidebar",
        description: "Use the sidebar to navigate between different sections: Home, My Palettes, My Uploads, Explore, Usage, and Plan settings.",
        placement: "right",
      },
      {
        id: "manual-builder",
        selector: '[data-tour="dashboard-manual"]',
        title: "Manual Builder",
        description: "Create color palettes manually with full control. Lock colors, regenerate, and save your creations.",
        placement: "bottom",
      },
      {
        id: "ai-generator",
        selector: '[data-tour="dashboard-ai"]',
        title: "AI Palette Generator",
        description: "Generate beautiful color palettes using AI. Just describe what you want, and AI will create it for you!",
        placement: "bottom",
      },
      {
        id: "explore",
        selector: '[data-tour="dashboard-explore"]',
        title: "Explore Palettes",
        description: "Browse thousands of curated color palettes. Find inspiration and discover new color combinations.",
        placement: "bottom",
      },
      {
        id: "my-palettes",
        selector: '[data-tour="dashboard-palettes"]',
        title: "My Palettes",
        description: "View all your saved palettes. Click on any palette name to see detailed color information and descriptions.",
        placement: "bottom",
      },
    ],
    []
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isPaidPlan =
    profile?.plan &&
    profile.plan !== "free" &&
    (profile.is_active ?? false);

  const renderContent = () => {
    switch (currentView) {
      case "generator":
        // Paid plans get the Pro Builder by default
        if (isPaidPlan) {
          return (
            <ProPaletteBuilder
              onBrowse={() => navigate("/explore")}
              onHome={() => setCurrentView("home")}
              onOldDesign={() => setCurrentView("generator-old")}
            />
          );
        }
        // Free plan gets the classic generator
        return (
          <PaletteGenerator
            onBrowse={() => navigate("/explore")}
            onHome={() => setCurrentView("home")}
          />
        );
      case "generator-old":
        // Old design for paid users who want to switch back
        return (
          <PaletteGenerator
            onBrowse={() => navigate("/explore")}
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
  if (currentView === "generator" || currentView === "generator-old") {
    return renderContent();
  }

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar 
        profile={profile} 
        currentView={currentView} 
        onViewChange={handleViewChange}
        data-tour="dashboard-sidebar"
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
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <button
                onClick={() => setCurrentView("generator")}
                className="p-6 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors text-left group"
                data-tour="dashboard-manual"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Palette className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Manual Builder</h3>
                <p className="text-sm text-muted-foreground">
                  Create a new color palette manually from scratch.
                </p>
              </button>

              <button
                onClick={() => setShowAIGenerator(true)}
                className="p-6 bg-card border border-border rounded-xl hover:border-accent/50 transition-colors text-left group"
                data-tour="dashboard-ai"
              >
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <Sparkles className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold mb-2">KI-Paletten-Generator</h3>
                <p className="text-sm text-muted-foreground">
                  Generate beautiful palettes with AI assistance.
                </p>
              </button>

              <button
                onClick={() => navigate("/explore")}
                className="p-6 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors text-left group"
                data-tour="dashboard-explore"
              >
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
                  <Compass className="h-6 w-6 text-purple-500" />
                </div>
                <h3 className="font-semibold mb-2">Explore Palettes</h3>
                <p className="text-sm text-muted-foreground">
                  Browse 50,000+ curated color palettes for inspiration.
                </p>
              </button>

              <button
                onClick={() => setCurrentView("my-palettes")}
                className="p-6 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors text-left group"
                data-tour="dashboard-palettes"
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

            {/* Usage Stats */}
            {profile && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Your Usage This Month</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">AI Palettes Generated</span>
                      <Palette className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-3xl font-bold">
                      {generationCount} <span className="text-lg font-normal text-muted-foreground">/ {getPlanLimits(profile.plan).palettesPerMonth}</span>
                    </p>
                    {generationCount >= getPlanLimits(profile.plan).palettesPerMonth && (
                      <p className="text-xs text-amber-500 mt-2">Limit reached - Upgrade for more!</p>
                    )}
                  </div>
                  <div className="bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Ask Mode Chat Messages</span>
                      <Home className="h-5 w-5 text-accent" />
                    </div>
                    <p className="text-3xl font-bold">
                      {chatUsageCount} <span className="text-lg font-normal text-muted-foreground">/ {getPlanLimits(profile.plan).chatMessagesPerMonth}</span>
                    </p>
                    {chatUsageCount >= getPlanLimits(profile.plan).chatMessagesPerMonth && getPlanLimits(profile.plan).chatMessagesPerMonth > 0 && (
                      <p className="text-xs text-amber-500 mt-2">Limit reached - Upgrade for more!</p>
                    )}
                    {getPlanLimits(profile.plan).chatMessagesPerMonth === 0 && (
                      <p className="text-xs text-muted-foreground mt-2">Upgrade to Pro to use Ask Mode</p>
                    )}
                  </div>
                </div>
              </div>
            )}
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
                    <button
                      onClick={() => setSelectedPalette(palette)}
                      className="font-medium mb-2 truncate text-left hover:text-primary transition-colors"
                      title="View details"
                    >
                      {palette.name}
                    </button>
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

        {currentView === "uploads" && (
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">My Uploads</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage your uploaded images and saved links
                </p>
              </div>
            </div>

            {loadingAssets ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : userAssets.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No uploads yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload images or add links in the Manual Builder to see them here.
                </p>
                <button
                  onClick={() => setCurrentView("generator")}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                >
                  Go to Manual Builder
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Images Section */}
                {userAssets.filter(a => a.type === "image").length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Image className="h-5 w-5 text-primary" />
                      Images ({userAssets.filter(a => a.type === "image").length})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {userAssets.filter(a => a.type === "image").map((asset) => (
                        <div
                          key={asset.id}
                          className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-colors"
                        >
                          <div className="aspect-square">
                            <img 
                              src={asset.displayUrl || asset.url} 
                              alt={asset.filename || "Uploaded image"} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                            <p className="text-white text-xs text-center px-2 truncate max-w-full">
                              {asset.filename || "Image"}
                            </p>
                            <button
                              onClick={() => deleteAsset(asset.id, asset.url, asset.type)}
                              className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </div>
                          <div className="p-2 border-t border-border">
                            <p className="text-xs text-muted-foreground truncate">
                              {new Date(asset.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Links Section */}
                {userAssets.filter(a => a.type === "link").length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <LinkIcon className="h-5 w-5 text-accent" />
                      Links ({userAssets.filter(a => a.type === "link").length})
                    </h3>
                    <div className="space-y-2">
                      {userAssets.filter(a => a.type === "link").map((asset) => {
                        let displayUrl = asset.url;
                        try {
                          const url = new URL(asset.url);
                          displayUrl = url.hostname;
                        } catch {
                          // Keep original if parsing fails
                        }
                        
                        return (
                          <div
                            key={asset.id}
                            className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors"
                          >
                            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                              <LinkIcon className="w-5 h-5 text-accent" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{displayUrl}</p>
                              <p className="text-sm text-muted-foreground truncate">{asset.url}</p>
                            </div>
                            <p className="text-xs text-muted-foreground flex-shrink-0">
                              {new Date(asset.created_at).toLocaleDateString()}
                            </p>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <a
                                href={asset.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => deleteAsset(asset.id, asset.url, asset.type)}
                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {currentView === "usage" && (
          <UsageContent
            profile={profile}
            generationCount={generationCount}
            chatUsageCount={chatUsageCount}
          />
        )}

        {currentView === "plan" && (
          <PlanContent 
            profile={profile} 
            generationCount={generationCount} 
            lastGeneration={lastGeneration} 
          />
        )}
      </main>

      {/* AI Palette Generator Modal */}
      <AIPaletteGenerator 
        isOpen={showAIGenerator} 
        onClose={() => setShowAIGenerator(false)} 
      />

      {selectedPalette && (
        <PaletteDetailModal
          palette={{
            name: selectedPalette.name,
            colors: selectedPalette.colors,
            description: selectedPalette.description,
            colorDescriptions: selectedPalette.color_descriptions,
          }}
          onClose={() => setSelectedPalette(null)}
        />
      )}

      {currentView === "home" && (
        <GuidedTour storageKey="tour-dashboard" steps={dashboardTourSteps} enabled />
      )}
    </div>
  );
};

export default Dashboard;
