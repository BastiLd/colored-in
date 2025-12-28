import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Send, X, Sparkles, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getFreePalettes, Palette } from "@/data/palettes";
import { User } from "@supabase/supabase-js";

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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Session expired. Please sign in again.");
        navigate("/auth");
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('generate-palette', {
        body: { prompt: prompt.trim() }
      });

      if (error) throw error;
      if (data.error) {
        if (data.limitReached) {
          setHasReachedLimit(true);
        }
        throw new Error(data.error);
      }

      setGeneratedPalette(data);
      setGenerationCount(prev => prev + 1);
      // Check if new count reaches limit
      const limit = PLAN_LIMITS[userPlan] ?? PLAN_LIMITS.free;
      if (generationCount + 1 >= limit) {
        setHasReachedLimit(true);
      }
      toast.success("Palette created and added to public collection!", { duration: 2000 });
    } catch (error: any) {
      console.error('Error generating palette:', error);
      toast.error(error.message || "Failed to generate palette. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyColor = (color: string) => {
    navigator.clipboard.writeText(color);
    toast.success(`Copied ${color}`, { duration: 1500 });
  };

  const copyAllColors = () => {
    if (!generatedPalette) return;
    navigator.clipboard.writeText(generatedPalette.colors.join(", "));
    toast.success("Copied all colors!", { duration: 1500 });
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
          )}

          {/* Generated palette display */}
          {generatedPalette && (
            <div className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">{generatedPalette.name}</h3>
                <button
                  onClick={copyAllColors}
                  className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80 transition-colors"
                >
                  Copy All
                </button>
              </div>
              
              <div className="flex rounded-xl overflow-hidden h-24">
                {generatedPalette.colors.map((color, i) => (
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
    </div>
  );
}
