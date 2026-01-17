import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getFreePalettes, type Palette } from "@/data/palettes";
import { AIPaletteGenerator } from "./AIPaletteGenerator";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { LogOut, User as UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HomePageProps {
  onStartGenerator: () => void;
  onBrowsePalettes: () => void;
}

// Interactive animated title
function AnimatedTitle() {
  // Render as two lines to prevent awkward mid-word line breaks (each character is a span).
  // This also guarantees "palettes" starts on the next line on the homepage.
  const lines = ["The super fast color", "palettes generator!"];
  const text = lines.join(" ");
  const [charStates, setCharStates] = useState<Map<number, {
    colored: boolean;
    timeout: NodeJS.Timeout | null;
  }>>(new Map());
  const [exploded, setExploded] = useState(false);
  const [explodeActive, setExplodeActive] = useState(false);
  const [flyingBack, setFlyingBack] = useState(false);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const explosionCycleRef = useRef(0);
  const explodeParamsRef = useRef<Map<number, { x: number; y: number; rotation: number }>>(new Map());

  // Get blue/yellow color
  const getRandomColor = () => {
    const colors = ["#3B82F6", "#60A5FA", "#93C5FD",
    // Blues
    "#FBBF24", "#FCD34D", "#FDE68A",
    // Yellows
    "#22D3EE", "#67E8F9",
    // Cyan blues
    "#F59E0B", "#D97706" // Amber/golden
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };
  const handleMouseEnter = (index: number, char: string) => {
    if (char === " " || exploded) return;
    setCharStates(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(index);

      // Clear existing timeout if any
      if (existing?.timeout) {
        clearTimeout(existing.timeout);
      }

      // Set colored state
      const timeout = setTimeout(() => {
        setCharStates(current => {
          const updated = new Map(current);
          updated.set(index, {
            colored: false,
            timeout: null
          });
          return updated;
        });
      }, 3000);
      newMap.set(index, {
        colored: true,
        timeout
      });
      return newMap;
    });
  };

  // Check if all non-space chars are colored
  const nonSpaceChars = text.split("").filter(c => c !== " ");
  const coloredCount = Array.from(charStates.entries()).filter(([idx, state]) => text[idx] !== " " && state.colored).length;
  useEffect(() => {
    if (coloredCount >= nonSpaceChars.length && !exploded && coloredCount > 0) {
      explosionCycleRef.current += 1;
      explodeParamsRef.current = new Map();
      setExplodeActive(false);
      // Precompute stable explosion params for this cycle (so letters actually "fly" instead of jumping around).
      for (let i = 0; i < text.length; i++) {
        if (text[i] === " ") continue;
        const base = explosionCycleRef.current * 1000 + i * 123.456;
        const frac = (n: number) => {
          const x = Math.sin(n) * 10000;
          return x - Math.floor(x);
        };
        const rand = (salt: number, min: number, max: number) =>
          min + frac(base + salt) * (max - min);

        // "Before change" feel: moderate distances + rotation, no scaling, fixed duration handled by CSS transition.
        const angle = rand(1.1, 0, 360);
        const distance = rand(2.2, 200, 600);
        const x = Math.cos(angle * Math.PI / 180) * distance;
        const y = Math.sin(angle * Math.PI / 180) * distance;
        const rotation = rand(3.3, -360, 360);
        explodeParamsRef.current.set(i, { x, y, rotation });
      }

      setExploded(true);
      // Ensure the browser paints the "pre-explode" frame (opacity 1, transform none)
      // before we apply the flying transform. This prevents "teleporting".
      requestAnimationFrame(() => {
        setExplodeActive(true);
      });

      // Fly back after 5 seconds
      setTimeout(() => {
        setFlyingBack(true);
        setTimeout(() => {
          setExploded(false);
          setExplodeActive(false);
          setFlyingBack(false);
          setCharStates(new Map());
        }, 800);
      }, 5000);
    }
  }, [coloredCount, nonSpaceChars.length, exploded]);
  const getExplosionStyle = (index: number): React.CSSProperties => {
    if (!exploded) return {};
    if (text[index] === " ") return {};
    
    const p = explodeParamsRef.current.get(index);
    // Fallback (shouldn't happen): keep it sane and consistent.
    const x = p?.x ?? 300;
    const y = p?.y ?? 0;
    const rotation = p?.rotation ?? 0;
    
    if (flyingBack) {
      return {
        transform: `translate(0, 0) rotate(0deg)`,
        opacity: 1,
      };
    }
    
    if (!explodeActive) {
      return {
        transform: `translate(0, 0) rotate(0deg)`,
        opacity: 1,
      };
    }

    return {
      transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)`,
      opacity: 0,
    };
  };
  return <div className="font-display">
      <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold italic leading-tight select-none">
        {(() => {
          const nodes: React.ReactNode[] = [];
          let globalIndex = 0;

          for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            if (lineIdx > 0) {
              // In `text` we have a single separator space between lines (lines.join(" ")).
              globalIndex += 1;
            }

            let linePos = 0;
            const words = line.split(" ");

            nodes.push(
              <span key={`line-${lineIdx}`} className="block">
                {words.map((word, wordIdx) => {
                  if (wordIdx > 0) {
                    // account for the space in the original `text`
                    linePos += 1;
                  }

                  const wordStart = globalIndex + linePos;
                  linePos += word.length;

                  return (
                    <span key={`word-${lineIdx}-${wordIdx}`} className="inline-block whitespace-nowrap">
                      {word.split("").map((char, j) => {
                        const i = wordStart + j;
                        const state = charStates.get(i);
                        const isColored = state?.colored || false;
                        return (
                          <span
                            key={i}
                            ref={(el) => {
                              charRefs.current[i] = el;
                            }}
                            className={`
                              inline-block transition-all cursor-default
                              ${!exploded && isColored ? "animate-shake" : ""}
                              ${!exploded && !isColored ? "hover:animate-shake" : ""}
                            `}
                            style={{
                              color: isColored ? getRandomColor() : "#FFFFFF",
                              transition: `${isColored ? "color 0.2s ease" : "color 0.5s ease 0.1s"}, transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
                              willChange: "transform, opacity",
                              ...getExplosionStyle(i),
                            }}
                            onMouseEnter={() => handleMouseEnter(i, char)}
                          >
                            {char}
                          </span>
                        );
                      })}
                      {wordIdx < words.length - 1 ? "\u00A0" : null}
                    </span>
                  );
                })}
              </span>
            );

            globalIndex += line.length;
          }

          return nodes;
        })()}
      </h1>
    </div>;
}

// Mini palette card for the grid
function MiniPaletteCard({
  palette,
  onClick
}: {
  palette: Palette;
  onClick: () => void;
}) {
  const [hoveredColor, setHoveredColor] = useState<number | null>(null);
  const copyColor = (e: React.MouseEvent, color: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(color);
    toast.success(`Copied ${color}`, {
      duration: 1500,
      position: "bottom-center"
    });
  };
  return <div className="rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform duration-200 shadow-lg" onClick={onClick}>
      <div className="flex h-12">
        {palette.colors.map((color, i) => <div key={i} className="transition-all duration-200 flex items-center justify-center" style={{
        backgroundColor: color,
        flex: hoveredColor === i ? 2 : 1
      }} onMouseEnter={() => setHoveredColor(i)} onMouseLeave={() => setHoveredColor(null)} onClick={e => copyColor(e, color)}>
            {hoveredColor === i && <span className="text-[10px] font-mono font-medium" style={{
          color: getContrastColor(color)
        }}>
                {color.replace('#', '')}
              </span>}
          </div>)}
      </div>
    </div>;
}

// Featured palette display
function FeaturedPalette({
  palette
}: {
  palette: Palette;
}) {
  const [hoveredColor, setHoveredColor] = useState<number | null>(null);
  const copyColor = (color: string) => {
    navigator.clipboard.writeText(color);
    toast.success(`Copied ${color}`, {
      duration: 1500,
      position: "bottom-center"
    });
  };
  return <div className="rounded-2xl overflow-hidden shadow-2xl">
      <div className="flex h-48 md:h-64">
        {palette.colors.map((color, i) => <div key={i} className="transition-all duration-300 flex items-center justify-center cursor-pointer" style={{
        backgroundColor: color,
        flex: hoveredColor === i ? 1.5 : 1
      }} onMouseEnter={() => setHoveredColor(i)} onMouseLeave={() => setHoveredColor(null)} onClick={() => copyColor(color)}>
            {hoveredColor === i && <span className="text-sm font-mono font-medium px-2 py-1 rounded bg-black/20 backdrop-blur-sm" style={{
          color: getContrastColor(color)
        }}>
                {color}
              </span>}
          </div>)}
      </div>
    </div>;
}
function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}
export function HomePage({
  onStartGenerator,
  onBrowsePalettes
}: HomePageProps) {
  const navigate = useNavigate();
  const palettes = useMemo(() => getFreePalettes().slice(0, 12), []);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const featuredPalette = palettes[featuredIndex];

  // Auth state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          // Fetch user plan
          supabase
            .from('user_subscriptions')
            .select('plan, is_active')
            .eq('user_id', session.user.id)
            .single()
            .then(({ data }) => {
              if (data?.is_active && data?.plan) {
                setUserPlan(data.plan);
              } else {
                setUserPlan('free');
              }
            });
        } else {
          setUserPlan(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Fetch user plan
        supabase
          .from('user_subscriptions')
          .select('plan, is_active')
          .eq('user_id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data?.is_active && data?.plan) {
              setUserPlan(data.plan);
            } else {
              setUserPlan('free');
            }
          });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Rotate featured palette
  useEffect(() => {
    const interval = setInterval(() => {
      setFeaturedIndex(prev => (prev + 1) % palettes.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [palettes.length]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
  };

  // Handle Manual Generator click with plan check
  const handleManualGenerator = () => {
    if (!user) {
      // Not logged in - redirect to auth
      toast.info("Please sign in to access the Manual Generator");
      navigate("/auth");
      return;
    }
    
    const paidPlans = ['pro', 'ultra', 'individual'];
    if (userPlan && paidPlans.includes(userPlan.toLowerCase())) {
      // Has Pro+ plan - go directly to the dashboard's generator view (Pro Builder)
      navigate("/dashboard?view=generator");
    } else {
      // Free plan - show upgrade prompt or use basic generator
      onStartGenerator();
    }
  };

  return <div className="min-h-screen bg-background relative">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h1 className="text-xl font-bold text-gradient font-display">Colored In</h1>
        <nav className="flex items-center gap-4">
          <button onClick={() => navigate("/pricing")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Go Pro
          </button>
          {!user ? (
            <>
              <button onClick={() => navigate("/auth")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Sign in
              </button>
              <button onClick={() => navigate("/auth")} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
                Sign up
              </button>
            </>
          ) : (
            <button onClick={() => navigate("/dashboard")} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
              Dashboard
            </button>
          )}
        </nav>
      </header>

      {/* Profile icon in bottom left when logged in */}
      {user && (
        <div className="fixed bottom-6 left-6 z-50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-semibold text-lg shadow-lg hover:opacity-90 transition-opacity">
                {user.email?.[0]?.toUpperCase() ?? <UserIcon className="h-5 w-5" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-48">
              <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                <UserIcon className="h-4 w-4 mr-2" />
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Hero Section */}
      <main className="container mx-auto px-6 py-12 md:py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
          {/* Left - Text */}
          <div className="space-y-8">
            <div className="space-y-4">
              <AnimatedTitle />
              <p className="text-lg text-muted-foreground max-w-md">
                Create the perfect palette or get inspired by thousands of beautiful color schemes.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <button onClick={() => setShowAIGenerator(true)} className="px-6 py-3 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all shadow-lg hover:scale-105">
                Generate with AI
              </button>
              <button onClick={handleManualGenerator} className="px-6 py-3 text-sm font-medium bg-secondary text-secondary-foreground border border-border rounded-lg hover:bg-muted transition-colors hover:scale-105">
                Manual Generator
              </button>
              <button onClick={onBrowsePalettes} className="px-6 py-3 text-sm font-medium bg-secondary text-secondary-foreground border border-border rounded-lg hover:bg-muted transition-colors hover:scale-105">
                Explore 50.000+ Palettes
              </button>
            </div>

            <p className="text-sm text-muted-foreground italic">And much more</p>
          </div>

          {/* Right - Palette Display */}
          <div className="space-y-6">
            {/* Mini palette grid */}
            <div className="grid grid-cols-3 gap-3">
              {palettes.slice(0, 9).map((palette, i) => <MiniPaletteCard key={palette.id} palette={palette} onClick={() => setFeaturedIndex(i)} />)}
            </div>

            {/* Featured palette */}
            <FeaturedPalette palette={featuredPalette} />
          </div>
        </div>

        {/* Features Section with Builder Images */}
        <div className="mt-32 space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Powerful Features for Creative Professionals</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to create, manage, and explore beautiful color palettes
            </p>
          </div>

          {/* Feature Cards with Images */}
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1: Manual Builder */}
            <div className="group bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all hover:shadow-xl">
              <div className="relative mb-6 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 aspect-video flex items-center justify-center">
                {/* Builder Preview Illustration */}
                <div className="w-full h-full flex flex-col">
                  <div className="flex h-1/2 gap-0">
                    {['#8F1919', '#C53535', '#DB7458', '#DBAA7F', '#F0E1BA'].map((color, i) => (
                      <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <div className="h-1/2 bg-muted/50 flex items-center justify-center">
                    <Palette className="w-12 h-12 text-primary/50" />
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Pro Manual Builder</h3>
              <p className="text-sm text-muted-foreground">
                Full control over every color. Lock, regenerate, harmonize, and save your perfect palettes with advanced tools.
              </p>
            </div>

            {/* Feature 2: AI Generator */}
            <div className="group bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all hover:shadow-xl">
              <div className="relative mb-6 rounded-xl overflow-hidden bg-gradient-to-br from-accent/20 to-pink-500/20 aspect-video flex items-center justify-center">
                <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                  <Sparkles className="w-16 h-16 text-accent/50 animate-pulse" />
                  <div className="flex gap-2">
                    {['#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE'].map((color, i) => (
                      <div key={i} className="w-12 h-12 rounded-lg" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Palette Generator</h3>
              <p className="text-sm text-muted-foreground">
                Describe your vision and let AI create stunning color palettes with detailed explanations for each color.
              </p>
            </div>

            {/* Feature 3: Asset Analysis */}
            <div className="group bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all hover:shadow-xl">
              <div className="relative mb-6 rounded-xl overflow-hidden bg-gradient-to-br from-purple-500/20 to-pink-500/20 aspect-video flex items-center justify-center">
                <div className="w-full h-full flex flex-col items-center justify-center space-y-3">
                  <div className="w-20 h-20 rounded-lg bg-muted/50 border-2 border-dashed border-primary/30 flex items-center justify-center">
                    <Image className="w-8 h-8 text-primary/50" />
                  </div>
                  <div className="flex gap-1">
                    {['#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE'].map((color, i) => (
                      <div key={i} className="w-8 h-8 rounded" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">Asset Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Upload images or add website links. AI analyzes them and generates matching color palettes automatically.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-32 space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Frequently Asked Questions</h2>
            <p className="text-muted-foreground">Everything you need to know about Colored In</p>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            <details className="group bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors">
              <summary className="cursor-pointer font-semibold text-lg mb-3 list-none flex items-center justify-between">
                <span>Was ist der Pro Manual Builder?</span>
                <span className="text-primary group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-muted-foreground mt-4 leading-relaxed">
                Der Pro Manual Builder ist ein professionelles Tool zum Erstellen von Farbpaletten mit vollständiger Kontrolle über jeden Aspekt. 
                Du kannst Farben manuell auswählen, sperren, regenerieren, harmonisieren und mit KI-Unterstützung optimieren. 
                Es bietet erweiterte Funktionen wie Asset-Upload, KI-Analyse von Bildern und Websites, Chat-Unterstützung für Farbtheorie-Fragen, 
                und die Möglichkeit, Paletten zu speichern und zu organisieren.
              </p>
            </details>

            <details className="group bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors">
              <summary className="cursor-pointer font-semibold text-lg mb-3 list-none flex items-center justify-between">
                <span>Wofür braucht man den?</span>
                <span className="text-primary group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-muted-foreground mt-4 leading-relaxed">
                Der Pro Manual Builder ist ideal für Designer, Entwickler, Marketer und alle kreativen Profis, die präzise Farbpaletten benötigen. 
                Nutze ihn für Branding-Projekte, Webdesign, UI/UX-Design, Marketing-Materialien, oder um Inspiration aus bestehenden Designs zu extrahieren. 
                Die KI-Analyse-Funktion ermöglicht es dir, Farben aus Logos, Websites oder Bildern zu extrahieren und zu verbessern.
              </p>
            </details>

            <details className="group bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors">
              <summary className="cursor-pointer font-semibold text-lg mb-3 list-none flex items-center justify-between">
                <span>Warum soll ich dafür Geld bezahlen, was ist mein Mehrwert wenn ich das besitze?</span>
                <span className="text-primary group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-muted-foreground mt-4 leading-relaxed">
                Mit dem Pro Manual Builder sparst du wertvolle Zeit und erhältst professionelle Ergebnisse. 
                Du bekommst unbegrenzte KI-Paletten-Generierungen (je nach Plan), Asset-Analyse für Bilder und Websites, 
                erweiterte Bearbeitungsfunktionen, Chat-Unterstützung für Farbtheorie, Zugriff auf tausende kuratierte Paletten, 
                und die Möglichkeit, deine Paletten zu speichern und zu organisieren. 
                Die Zeitersparnis und die Qualität der Ergebnisse machen die Investition mehr als wett.
              </p>
            </details>

            <details className="group bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors">
              <summary className="cursor-pointer font-semibold text-lg mb-3 list-none flex items-center justify-between">
                <span>Wie sieht der aus?</span>
                <span className="text-primary group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-muted-foreground mt-4 leading-relaxed">
                Der Pro Manual Builder hat ein modernes, intuitives Interface mit drei Hauptbereichen: 
                Links die Ressourcen-Sidebar mit Paletten, Farben und Assets, in der Mitte die große Palette-Canvas 
                mit auswählbaren Farbfeldern, und rechts der KI-Chat-Assistent. 
                Die Oberfläche ist dunkel gehalten für bessere Farbwahrnehmung und bietet alle Tools, die du brauchst, 
                ohne überladen zu wirken. Probiere es einfach aus - die erste Tour führt dich durch alle Funktionen!
              </p>
            </details>
          </div>
        </div>
      </main>

      {/* AI Palette Generator Modal */}
      <AIPaletteGenerator isOpen={showAIGenerator} onClose={() => setShowAIGenerator(false)} />
    </div>;
}