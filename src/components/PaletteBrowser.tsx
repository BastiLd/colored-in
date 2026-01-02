import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Search, ArrowLeft, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Palette, getPalettesByPlan, searchAllPalettes } from "@/data/palettes";
import { Input } from "@/components/ui/input";
import { PaletteModal } from "./PaletteModal";
import { supabase } from "@/integrations/supabase/client";

interface PaletteBrowserProps {
  onBack: () => void;
  onSelectPalette: (colors: string[]) => void;
}

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

function PaletteCard({ 
  palette, 
  onOpenModal 
}: { 
  palette: Palette; 
  onOpenModal: (palette: Palette) => void;
}) {
  const [hoveredColor, setHoveredColor] = useState<number | null>(null);

  // Reset hover state when palette changes
  useEffect(() => {
    setHoveredColor(null);
  }, [palette.id]);

  const copyColor = (e: React.MouseEvent, color: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(color);
    toast.success(`Copied ${color}`, { duration: 1500, position: "bottom-center" });
  };

  return (
    <div 
      className="group relative bg-card rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer animate-fade-in"
      onClick={() => onOpenModal(palette)}
    >
      {/* Color Preview - Coolors style: tall strips, no gaps */}
      <div className="flex h-20 sm:h-24 overflow-hidden rounded-lg">
        {palette.colors && palette.colors.length > 0 ? palette.colors.map((color, i) => {
          const isHovered = hoveredColor === i;
          return (
            <div
              key={`${palette.id}-color-${i}`}
              className="relative flex-1 transition-all duration-200 group-hover:first:flex-[1.1] group-hover:last:flex-[1.1] cursor-pointer"
              style={{ backgroundColor: color || '#000000' }}
              onMouseEnter={() => setHoveredColor(i)}
              onMouseLeave={() => setHoveredColor(null)}
              onClick={(e) => copyColor(e, color)}
            >
              {isHovered && color && (
                <div 
                  className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px] z-10 pointer-events-none"
                >
                  <span 
                    className="text-[10px] sm:text-xs font-mono font-semibold px-1.5 py-0.5 rounded bg-black/30"
                    style={{ color: '#FFFFFF' }}
                  >
                    {color.replace('#', '').toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          );
        }) : null}
      </div>

      {/* Info - minimal like Coolors */}
      <div className="p-2.5 flex items-center justify-between bg-card">
        <span className="text-sm font-medium text-foreground truncate max-w-[70%]">
          {palette.name}
        </span>
        
        {!palette.isFree && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
            <Lock className="w-3 h-3" />
            <span>Pro</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function PaletteBrowser({ onBack, onSelectPalette }: PaletteBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPalette, setSelectedPalette] = useState<Palette | null>(null);
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [dbPalettes, setDbPalettes] = useState<Palette[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userPlan, setUserPlan] = useState<string>("free");
  const loaderRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 50;

  // Fetch user plan and load initial batch
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      let plan = "free";
      
      if (session?.user) {
        const { data: subData } = await supabase
          .from("user_subscriptions")
          .select("plan")
          .eq("user_id", session.user.id)
          .single();
        
        if (subData?.plan) {
          plan = subData.plan;
        }
      }
      
      setUserPlan(plan);
      const initial = getPalettesByPlan(plan, 0, PAGE_SIZE);
      setPalettes(initial.palettes);
      setHasMore(initial.hasMore);
      setTotal(initial.total);
      setPage(1);

      // Load user-created palettes from database
      const { data: userPalettes } = await supabase
        .from("public_palettes")
        .select("id, name, colors, tags")
        .order("created_at", { ascending: false });

      if (userPalettes) {
        const formattedPalettes: Palette[] = userPalettes.map(p => ({
          id: p.id,
          name: p.name,
          colors: p.colors,
          tags: p.tags,
          isFree: true
        }));
        setDbPalettes(formattedPalettes);
      }
    };
    
    init();
  }, []);

  // Infinite scroll loader
  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    setLoading(true);
    
    // Small delay to prevent rapid fire
    setTimeout(() => {
      const result = getPalettesByPlan(userPlan, page, PAGE_SIZE);
      setPalettes(prev => [...prev, ...result.palettes]);
      setHasMore(result.hasMore);
      setPage(prev => prev + 1);
      setLoading(false);
    }, 100);
  }, [page, loading, hasMore, userPlan]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [loadMore, hasMore, loading]);

  // Filter palettes based on search - search ALL palettes including DB palettes
  const filteredPalettes = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase().trim();
    if (!lowerQuery) {
      // When no search, combine DB palettes at the beginning with static palettes
      return [...dbPalettes, ...palettes];
    }
    
    // Search through ALL 50,000 static palettes regardless of plan
    const staticResults = searchAllPalettes(searchQuery);
    
    // Search through database palettes
    const dbResults = dbPalettes.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) || 
      p.tags.some(t => t.toLowerCase().includes(lowerQuery)) ||
      p.colors.some(c => c.toLowerCase().includes(lowerQuery))
    );
    
    // Combine with DB palettes first (prioritize user-created)
    return [...dbResults, ...staticResults];
  }, [searchQuery, palettes, dbPalettes]);

  const handleOpenModal = (palette: Palette) => {
    setSelectedPalette(palette);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-card/80 backdrop-blur-lg border-b border-border">
        <button
          onClick={onBack}
          className="flex items-center gap-3 p-2 -ml-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          <h1 className="text-xl font-bold text-gradient font-display">Colored In</h1>
        </button>

        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search palettes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>

        <div className="text-sm text-muted-foreground">
          {searchQuery 
            ? `${filteredPalettes.length.toLocaleString()} results (all palettes)`
            : `${(palettes.length + dbPalettes.length).toLocaleString()} / ${(total + dbPalettes.length).toLocaleString()} loaded`
          }
        </div>
      </header>

      {/* Title */}
      <div className="px-6 py-8">
        <h2 className="text-4xl font-bold font-display text-foreground">Trending Color Palettes</h2>
        <p className="text-muted-foreground mt-2">Get inspired by 50,000+ beautiful color schemes.</p>
      </div>

      {/* Grid */}
      <div className="px-6 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPalettes.map((palette) => (
            <PaletteCard 
              key={palette.id} 
              palette={palette}
              onOpenModal={handleOpenModal}
            />
          ))}
        </div>

        {/* Infinite scroll loader */}
        {hasMore && !searchQuery && (
          <div ref={loaderRef} className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {filteredPalettes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg text-muted-foreground">No palettes found</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different search term</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedPalette && (
        <PaletteModal 
          palette={selectedPalette} 
          onClose={() => setSelectedPalette(null)} 
        />
      )}
    </div>
  );
}
