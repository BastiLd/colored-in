import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Send, X, Sparkles, Loader2, LogIn, Upload, Image as ImageIcon, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getFreePalettes, type Palette } from "@/data/palettes";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PaletteDetailModal } from "@/components/PaletteDetailModal";

interface AIPaletteGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
}

// Plan limits
const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  pro: 100,
  ultra: 500,
  individual: Infinity,
};

interface GeneratedPalette {
  name: string;
  colors: string[];
  tags: string[];
  description?: string;
  colorDescriptions?: string[];
}

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

// Find similar palettes based on color similarity
function findSimilarPalettes(generatedColors: string[], allPalettes: Palette[], count: number): Palette[] {
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };

  const colorDistance = (hex1: string, hex2: string) => {
    const c1 = hexToRgb(hex1);
    const c2 = hexToRgb(hex2);
    return Math.sqrt(
      Math.pow(c1.r - c2.r, 2) + 
      Math.pow(c1.g - c2.g, 2) + 
      Math.pow(c1.b - c2.b, 2)
    );
  };

  const paletteScore = (palette: Palette) => {
    let totalScore = 0;
    for (const genColor of generatedColors) {
      let minDist = Infinity;
      for (const palColor of palette.colors) {
        const dist = colorDistance(genColor, palColor);
        if (dist < minDist) minDist = dist;
      }
      totalScore += minDist;
    }
    return totalScore / generatedColors.length;
  };

  return [...allPalettes]
    .map(p => ({ palette: p, score: paletteScore(p) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map(p => p.palette);
}

function buildFallbackDescriptions(colors: string[]): string[] {
  const roleTemplates = [
    "This primary color anchors the palette and sets the visual tone.",
    "This secondary color supports the primary and adds depth.",
    "This accent color provides contrast and draws attention to key elements.",
    "This background/neutral color improves readability and balance.",
    "This highlight color adds subtle emphasis and polish.",
  ];

  return colors.map((color, index) => {
    const template = roleTemplates[index] || roleTemplates[roleTemplates.length - 1];
    return `${template} (${color})`;
  });
}

function buildImproveDescriptions(colors: string[]): string[] {
  const replaceTemplates = [
    "Replace the primary brand color with this option to improve recognition and trust.",
    "Replace the secondary/support color with this tone to add depth and balance.",
    "Replace the CTA/accent color with this shade to increase focus on key actions.",
    "Replace the background/neutral color with this to improve readability.",
    "Replace the text/contrast color with this value to strengthen legibility.",
  ];

  return colors.map((color, index) => {
    const template = replaceTemplates[index] || replaceTemplates[replaceTemplates.length - 1];
    return `${template} (${color})`;
  });
}

function normalizePaletteDescriptions(palette: GeneratedPalette): GeneratedPalette {
  const tags = palette.tags || [];
  const isImprove = tags.includes("improve") || tags.includes("improved");
  const descriptions = palette.colorDescriptions || [];

  if (descriptions.length === palette.colors.length) {
    return palette;
  }

  return {
    ...palette,
    colorDescriptions: isImprove
      ? buildImproveDescriptions(palette.colors)
      : buildFallbackDescriptions(palette.colors),
  };
}

// Orbiting palette component for LEFT side
function OrbitingPaletteLeft({ 
  palette, 
  index, 
  total, 
  radius 
}: { 
  palette: Palette; 
  index: number; 
  total: number;
  radius: number;
}) {
  return (
    <div
      className="absolute w-20 h-12 rounded-lg overflow-hidden shadow-lg opacity-80 hover:opacity-100 transition-opacity"
      style={{
        left: `calc(50% - ${radius + 100}px)`,
        top: `calc(50% - 24px)`,
        animation: `orbitLeft 20s linear infinite`,
        animationDelay: `-${(index / total) * 20}s`,
      }}
    >
      <div className="flex h-full">
        {palette.colors.slice(0, 4).map((color, i) => (
          <div
            key={i}
            className="flex-1"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}

// Orbiting palette component for RIGHT side
function OrbitingPaletteRight({ 
  palette, 
  index, 
  total, 
  radius 
}: { 
  palette: Palette; 
  index: number; 
  total: number;
  radius: number;
}) {
  return (
    <div
      className="absolute w-20 h-12 rounded-lg overflow-hidden shadow-lg opacity-80 hover:opacity-100 transition-opacity"
      style={{
        left: `calc(50% + ${radius - 20}px)`,
        top: `calc(50% - 24px)`,
        animation: `orbitRight 20s linear infinite`,
        animationDelay: `-${(index / total) * 20}s`,
      }}
    >
      <div className="flex h-full">
        {palette.colors.slice(0, 4).map((color, i) => (
          <div
            key={i}
            className="flex-1"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}

export function AIPaletteGenerator({ isOpen, onClose }: AIPaletteGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedPalette, setGeneratedPalette] = useState<GeneratedPalette | null>(null);
  const [hoveredColor, setHoveredColor] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [generationCount, setGenerationCount] = useState(0);
  const [hasReachedLimit, setHasReachedLimit] = useState(false);
  const navigate = useNavigate();
  
  // Logo improvement feature (Pro+ only)
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [improvementText, setImprovementText] = useState("");
  const [isImproving, setIsImproving] = useState(false);
  const [improvedPalette, setImprovedPalette] = useState<GeneratedPalette | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPaletteForDetail, setSelectedPaletteForDetail] = useState<GeneratedPalette | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isProPlus = userPlan === "pro" || userPlan === "ultra" || userPlan === "individual";
  
  const allPalettes = useMemo(() => getFreePalettes(), []);
  
  // Random palettes for orbiting - doubled amount, split for left and right
  const { leftPalettes, rightPalettes } = useMemo(() => {
    const shuffled = [...allPalettes].sort(() => Math.random() - 0.5);
    const count = 8; // 8 per side
    return {
      leftPalettes: shuffled.slice(0, count),
      rightPalettes: shuffled.slice(count, count * 2)
    };
  }, [allPalettes]);
  
  // Similar palettes after generation - split for left and right
  const { leftSimilar, rightSimilar } = useMemo(() => {
    if (!generatedPalette) return { leftSimilar: [], rightSimilar: [] };
    const similar = findSimilarPalettes(generatedPalette.colors, allPalettes, 16);
    return {
      leftSimilar: similar.slice(0, 8),
      rightSimilar: similar.slice(8, 16)
    };
  }, [generatedPalette, allPalettes]);

  const orbitingLeft = generatedPalette ? leftSimilar : leftPalettes;
  const orbitingRight = generatedPalette ? rightSimilar : rightPalettes;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkGenerationLimit = useCallback(async () => {
    if (!user) return;
    
    const [genResult, subResult] = await Promise.all([
      supabase
        .from('user_ai_generations')
        .select('generation_count')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('user_subscriptions')
        .select('plan, is_active')
        .eq('user_id', user.id)
        .single()
    ]);
    
    const count = genResult.data?.generation_count || 0;
    const plan = (subResult.data?.is_active && subResult.data?.plan) || 'free';
    const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
    
    setGenerationCount(count);
    setUserPlan(plan);
    setHasReachedLimit(count >= limit);
  }, [user]);

  useEffect(() => {
    if (user) {
      checkGenerationLimit();
    }
  }, [user, checkGenerationLimit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    if (!user) {
      toast.error("Please sign in to use AI palette generation");
      navigate("/auth");
      return;
    }

    if (hasReachedLimit) {
      const message = userPlan === 'free' 
        ? "You've used your free generation. Upgrade to Pro for more!"
        : "You've reached your plan limit. Upgrade for more generations!";
      toast.error(message);
      return;
    }

    setIsLoading(true);
    setGeneratedPalette(null);

    try {
      // Get the current session to ensure auth token is available
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        toast.error("Authentication error. Please sign in again.");
        setIsLoading(false);
        navigate("/auth");
        return;
      }
      
      if (!session) {
        toast.error("Session expired. Please sign in again.");
        setIsLoading(false);
        navigate("/auth");
        return;
      }

      console.log('Invoking generate-palette function with prompt:', prompt.trim().substring(0, 50));
      
      const { data, error } = await supabase.functions.invoke('generate-palette', {
        body: { prompt: prompt.trim() }
      });

      console.log('Function response:', { hasData: !!data, hasError: !!error, error });

      if (error) {
        console.error('Supabase function error:', error);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const status = (error as any)?.context?.status as number | undefined;
        if (status === 401) {
          toast.error("Session expired. Please sign in again.");
          navigate("/auth");
          return;
        }
        if (status === 403) {
          toast.error("Access denied. Please check your plan or sign in again.");
          return;
        }
        // Check for specific error types
        if (error.message?.includes('Failed to send') || error.message?.includes('fetch')) {
          throw new Error("Cannot reach the AI service. Please check your internet connection and try again.");
        }
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          throw new Error("AI service is not available. Please contact support.");
        }
        throw error;
      }
      
      if (data?.error) {
        if (data.limitReached) {
          setHasReachedLimit(true);
        }
        throw new Error(data.error);
      }

      if (!data || !data.colors || !Array.isArray(data.colors)) {
        console.error('Invalid data format:', data);
        throw new Error("Invalid response from server");
      }

      setGeneratedPalette(normalizePaletteDescriptions(data));
      setGenerationCount(prev => prev + 1);
      // Check if new count reaches limit
      const limit = PLAN_LIMITS[userPlan] ?? PLAN_LIMITS.free;
      if (generationCount + 1 >= limit) {
        setHasReachedLimit(true);
      }
      toast.success("Palette created and added to public collection!", { duration: 2000 });
    } catch (error: any) {
      console.error('Error generating palette:', error);
      let errorMessage = "Failed to generate palette. Please try again.";
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error) {
        errorMessage = error.error;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const copyColor = (color: string) => {
    navigator.clipboard.writeText(color);
    toast.success(`Copied ${color}`, { duration: 1500 });
  };

  const copyAllColors = () => {
    const palette = improvedPalette || generatedPalette;
    if (!palette) return;
    navigator.clipboard.writeText(palette.colors.join(", "));
    toast.success("Copied all colors!", { duration: 1500 });
  };

  const handleImproveLogo = async () => {
    if (!logoFile || !user) return;

    setIsImproving(true);
    setImprovedPalette(null);

    try {
      // Upload logo to storage
      const fileExt = logoFile.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("user-assets")
        .upload(filePath, logoFile);

      if (uploadError) {
        throw new Error("Failed to upload logo");
      }

      // Get signed URL
      const { data: signedUrlData } = await supabase.storage
        .from("user-assets")
        .createSignedUrl(filePath, 60 * 60);

      if (!signedUrlData?.signedUrl) {
        throw new Error("Failed to get logo URL");
      }

      // Call analyze-asset with improve mode
      const { data, error } = await supabase.functions.invoke('analyze-asset', {
        body: {
          assetType: 'image',
          assetUrl: signedUrlData.signedUrl,
          mode: 'improve',
          expandText: improvementText || 'Improve this logo and create a better color palette',
        }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.colors && Array.isArray(data.colors)) {
        const improved = normalizePaletteDescriptions({
          name: data.name || 'Improved Logo Palette',
          colors: data.colors,
          tags: data.tags || ['improved', 'logo'],
          description: data.description,
          colorDescriptions: data.colorDescriptions || [],
        });
        setImprovedPalette(improved);
        toast.success("Logo improved and palette generated!");
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error: any) {
      console.error('Error improving logo:', error);
      toast.error(error.message || "Failed to improve logo");
    } finally {
      setIsImproving(false);
    }
  };

  const handleViewDetail = (palette: GeneratedPalette) => {
    setSelectedPaletteForDetail(palette);
    setShowDetailModal(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center overflow-hidden">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors z-20"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Main content */}
      <div className="relative w-full max-w-6xl h-[700px] flex items-center justify-center">
        {/* Orbiting palettes - LEFT side */}
        <div className="absolute inset-0 pointer-events-none">
          <style>{`
            @keyframes orbitLeft {
              from {
                transform: rotate(0deg) translateX(180px) rotate(0deg);
              }
              to {
                transform: rotate(360deg) translateX(180px) rotate(-360deg);
              }
            }
            @keyframes orbitRight {
              from {
                transform: rotate(0deg) translateX(180px) rotate(0deg);
              }
              to {
                transform: rotate(-360deg) translateX(180px) rotate(360deg);
              }
            }
          `}</style>
          {orbitingLeft.map((palette, i) => (
            <OrbitingPaletteLeft
              key={`left-${palette.id}`}
              palette={palette}
              index={i}
              total={orbitingLeft.length}
              radius={280}
            />
          ))}
        </div>

        {/* Orbiting palettes - RIGHT side */}
        <div className="absolute inset-0 pointer-events-none">
          {orbitingRight.map((palette, i) => (
            <OrbitingPaletteRight
              key={`right-${palette.id}`}
              palette={palette}
              index={i}
              total={orbitingRight.length}
              radius={280}
            />
          ))}
        </div>

        {/* Center content */}
        <div className="relative z-10 w-full max-w-md p-6 bg-card/95 backdrop-blur-md rounded-2xl shadow-2xl border border-border">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary mb-4">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">AI Palette Generator</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              Describe your perfect palette
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              e.g. "Sunset over the ocean" or "Modern tech startup"
            </p>
            {!user && (
              <p className="text-xs text-primary mt-2">
                Sign in to get 1 free AI generation!
              </p>
            )}
            {user && !hasReachedLimit && (
              <p className="text-xs text-green-500 mt-2">
                ✨ {userPlan === 'individual' 
                  ? 'Unlimited generations available!'
                  : `${PLAN_LIMITS[userPlan] - generationCount} generations remaining (${userPlan} plan)`}
              </p>
            )}
            {user && hasReachedLimit && !generatedPalette && (
              <p className="text-xs text-orange-500 mt-2">
                Limit reached. Upgrade for more generations!
              </p>
            )}
          </div>

          {/* Chat input or Login prompt */}
          {!user ? (
            <div className="text-center py-4">
              <button
                onClick={() => navigate("/auth")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                <LogIn className="w-5 h-5" />
                Sign in to Generate
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="mb-6">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe colors, mood, or theme..."
                    className="flex-1 px-4 py-3 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isLoading || hasReachedLimit}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !prompt.trim() || hasReachedLimit}
                    className="px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </form>

              {/* Logo Improvement Feature (Pro+ only) */}
              {isProPlus && (
                <div className="mb-6 p-4 bg-muted/50 border border-border rounded-lg space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wand2 className="w-4 h-4 text-primary" />
                    <Label className="text-sm font-semibold">Improve Logo (Pro Feature)</Label>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setLogoFile(file);
                            const reader = new FileReader();
                            reader.onload = (e) => {
                              setLogoPreview(e.target?.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {logoFile ? logoFile.name : "Upload Logo"}
                      </Button>
                      {logoPreview && (
                        <div className="mt-2 relative">
                          <img
                            src={logoPreview}
                            alt="Logo preview"
                            className="w-full h-32 object-contain rounded-lg border border-border"
                          />
                          <button
                            onClick={() => {
                              setLogoFile(null);
                              setLogoPreview(null);
                            }}
                            className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:opacity-90"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="improvement-text" className="text-xs text-muted-foreground">
                        Optional: Describe how to improve the logo
                      </Label>
                      <Textarea
                        id="improvement-text"
                        value={improvementText}
                        onChange={(e) => setImprovementText(e.target.value)}
                        placeholder="e.g., Make it more vibrant and modern, add more contrast..."
                        className="mt-1 min-h-[60px] text-sm"
                        disabled={isImproving}
                      />
                    </div>

                    <Button
                      type="button"
                      onClick={handleImproveLogo}
                      disabled={!logoFile || isImproving}
                      className="w-full"
                      size="sm"
                    >
                      {isImproving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Improving...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4 mr-2" />
                          Improve Logo & Generate Palette
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Generated palette display */}
          {(generatedPalette || improvedPalette) && (
            <div className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">{(improvedPalette || generatedPalette)?.name}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewDetail((improvedPalette || generatedPalette)!)}
                    className="text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
                  >
                    View Details
                  </button>
                  <button
                    onClick={copyAllColors}
                    className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80 transition-colors"
                  >
                    Copy All
                  </button>
                </div>
              </div>
              
              <div className="flex rounded-xl overflow-hidden h-24">
                {(improvedPalette || generatedPalette)?.colors.map((color, i) => (
                  <div
                    key={i}
                    className="flex-1 flex items-center justify-center cursor-pointer transition-all duration-200 hover:flex-[1.5]"
                    style={{ backgroundColor: color }}
                    onClick={() => copyColor(color)}
                    onMouseEnter={() => setHoveredColor(i)}
                    onMouseLeave={() => setHoveredColor(null)}
                  >
                    {hoveredColor === i && (
                      <span
                        className="text-xs font-mono px-2 py-1 rounded bg-black/20"
                        style={{ color: getContrastColor(color) }}
                      >
                        {color}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {generatedPalette.colorDescriptions?.length ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Why these colors work</p>
                  <div className="space-y-2">
                    {generatedPalette.colors.map((color, i) => (
                      <div key={color + i} className="flex items-start gap-3 bg-muted/40 rounded-lg p-2">
                        <div
                          className="w-6 h-6 rounded-md flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-mono text-foreground">{color}</p>
                          <p className="text-xs text-muted-foreground">
                            {generatedPalette.colorDescriptions?.[i] || "Color role explanation unavailable."}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {generatedPalette.description ? (
                <p className="text-xs text-muted-foreground">{generatedPalette.description}</p>
              ) : null}

              <div className="flex gap-2 flex-wrap">
                {generatedPalette.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              
              <p className="text-xs text-center text-muted-foreground">
                ✅ This palette has been added to the public collection!
              </p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="text-center py-8 animate-in fade-in-50">
              <div className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Creating your palette...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedPaletteForDetail && (
        <PaletteDetailModal
          palette={{
            name: selectedPaletteForDetail.name,
            colors: selectedPaletteForDetail.colors,
            description: selectedPaletteForDetail.description,
            colorDescriptions: selectedPaletteForDetail.colorDescriptions,
          }}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedPaletteForDetail(null);
          }}
        />
      )}
    </div>
  );
}
