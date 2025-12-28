import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getFreePalettes, Palette } from "@/data/palettes";
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
  const text = "The super fast color palettes generator!";
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
        {text.split("").map((char, i) => {
        const state = charStates.get(i);
        const isColored = state?.colored || false;
        const isSpace = char === " ";
        return <span key={i} ref={el => {
          charRefs.current[i] = el;
        }} className={`
                inline-block transition-all cursor-default
                ${!isSpace && !exploded && isColored ? "animate-shake" : ""}
                ${!isSpace && !exploded && !isColored ? "hover:animate-shake" : ""}
              `} style={{
          color: isColored ? getRandomColor() : "#FFFFFF",
          // Keep transform/opacity transitions ALWAYS active to prevent "teleporting"
          // when we toggle exploded/flyingBack (otherwise transition+transform change in same frame may not animate).
          transition: `${isColored ? "color 0.2s ease" : "color 0.5s ease 0.1s"}, transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
          willChange: "transform, opacity",
          ...getExplosionStyle(i)
        }} onMouseEnter={() => handleMouseEnter(i, char)}>
              {char === " " ? "\u00A0" : char}
            </span>;
      })}
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
  const featuredPalette = palettes[featuredIndex];

  // Auth state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
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
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left - Text */}
          <div className="space-y-8">
            <AnimatedTitle />
            
            <p className="text-lg text-muted-foreground max-w-md">
              Create the perfect palette or get inspired by thousands of beautiful color schemes.
            </p>

            <div className="flex flex-wrap gap-4">
              <button onClick={() => setShowAIGenerator(true)} className="px-6 py-3 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all shadow-lg">
                Generate with AI
              </button>
              <button onClick={onStartGenerator} className="px-6 py-3 text-sm font-medium bg-secondary text-secondary-foreground border border-border rounded-lg hover:bg-muted transition-colors">
                Manual Generator
              </button>
              <button onClick={onBrowsePalettes} className="px-6 py-3 text-sm font-medium bg-secondary text-secondary-foreground border border-border rounded-lg hover:bg-muted transition-colors">
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
      </main>

      {/* AI Palette Generator Modal */}
      <AIPaletteGenerator isOpen={showAIGenerator} onClose={() => setShowAIGenerator(false)} />
    </div>;
}