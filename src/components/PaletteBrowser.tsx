import { useState, useMemo, useEffect, useCallback, useRef, memo } from "react";
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

// Stable PaletteCard component - memo prevents re-renders when props are equal
const PaletteCard = memo(function PaletteCard({ 
  palette, 
  onOpenModal 
}: { 
  palette: Palette; 
  onOpenModal: (palette: Palette) => void;
}) {
  // Local hover state - completely isolated per card instance
  const [hoveredColor, setHoveredColor] = useState<number | null>(null);
  
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PaletteBrowser.tsx:useEffect:mount',message:'PaletteCard mounted',data:{paletteId:palette.id,paletteName:palette.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
    return () => {
      fetch('http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PaletteBrowser.tsx:useEffect:unmount',message:'PaletteCard unmounted',data:{paletteId:palette.id,paletteName:palette.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
    };
  }, [palette.id, palette.name]);
  // #endregion

  const copyColor = (e: React.MouseEvent, color: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(color);
    toast.success(`Copied ${color}`, { duration: 1500, position: "bottom-center" });
  };

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PaletteBrowser.tsx:useEffect:hoveredColor',message:'hoveredColor state changed',data:{paletteId:palette.id,paletteName:palette.name,newHoveredColor:hoveredColor},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch(()=>{});
  }, [hoveredColor, palette.id, palette.name]);
  // #endregion

  const handleMouseEnter = (i: number) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PaletteBrowser.tsx:handleMouseEnter',message:'mouse enter',data:{paletteId:palette.id,paletteName:palette.name,colorIndex:i,isDbPalette:palette.id.includes('-') || palette.name.includes('Custom'),currentHoveredColor:hoveredColor},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    setHoveredColor(i);
  };

  const handleMouseLeave = () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4dbc215f-e85a-47d5-88db-cdaf6c66d6aa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PaletteBrowser.tsx:handleMouseLeave',message:'mouse leave',data:{paletteId:palette.id,paletteName:palette.name,currentHoveredColor:hoveredColor},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    setHoveredColor(null);
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
              onMouseEnter={() => handleMouseEnter(i)}
              onMouseLeave={handleMouseLeave}
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
}, (prevProps, nextProps) => {
  // Strict equality check for stable references
  // Returns true if props are equal (no re-render needed)
  if (prevProps.palette === nextProps.palette && 
      prevProps.onOpenModal === nextProps.onOpenModal) {
    return true;
  }
  // Fallback: deep comparison
  return prevProps.palette.id === nextProps.palette.id &&
         prevProps.onOpenModal === nextProps.onOpenModal &&
         prevProps.palette.name === nextProps.palette.name &&
         JSON.stringify(prevProps.palette.colors) === JSON.stringify(nextProps.palette.colors);
});

export function PaletteBrowser({ onBack, onSelectPalette }: PaletteBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPalette, setSelectedPalette] = useState<Palette | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [isInitialized, setIsInitialized] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 50;
  
  // STABLE REFERENCE STORAGE: These refs persist across renders
  // Static palettes - stored once, never recreated
  const staticPalettesRef = useRef<Palette[]>([]);
  // DB palettes - stored once after fetch, never recreated
  const dbPalettesRef = useRef<Palette[]>([]);
  // Current page for infinite scroll
  const pageRef = useRef(0);
  // Force update trigger
  const [, forceUpdate] = useState(0);

  // Fetch user plan and load initial batch - runs ONCE
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
      
      // Load initial static palettes
      const initial = getPalettesByPlan(plan, 0, PAGE_SIZE);
      staticPalettesRef.current = initial.palettes;
      setHasMore(initial.hasMore);
      setTotal(initial.total);
      pageRef.current = 1;

      // Load user-created palettes from database
      const { data: userPalettes } = await supabase
        .from("public_palettes")
        .select("id, name, colors, tags")
        .order("created_at", { ascending: false });

      if (userPalettes) {
        dbPalettesRef.current = userPalettes.map(p => ({
          id: p.id,
          name: p.name,
          colors: p.colors,
          tags: p.tags,
          isFree: true
        }));
      }
      
      // Mark as initialized - single state update triggers render
      setIsInitialized(true);
    };
    
    init();
  }, []);

  // Infinite scroll loader - updates refs, not state
  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    setLoading(true);
    
    setTimeout(() => {
      const result = getPalettesByPlan(userPlan, pageRef.current, PAGE_SIZE);
      // Append to existing ref array (mutate, don't replace)
      staticPalettesRef.current = [...staticPalettesRef.current, ...result.palettes];
      setHasMore(result.hasMore);
      pageRef.current += 1;
      setLoading(false);
      // Trigger re-render
      forceUpdate(n => n + 1);
    }, 100);
  }, [loading, hasMore, userPlan]);

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

  // STABLE filtered palettes - only recomputes when search changes
  // Uses refs for data, ensuring palette object references stay stable
  const filteredPalettes = useMemo(() => {
    if (!isInitialized) return [];
    
    const staticPalettes = staticPalettesRef.current;
    const dbPalettes = dbPalettesRef.current;
    const lowerQuery = searchQuery.toLowerCase().trim();
    
    if (!lowerQuery) {
      // No search: show DB palettes first, then static
      // Refs ensure these are always the SAME object references
      return [...dbPalettes, ...staticPalettes];
    }
    
    // Search mode: search through ALL palettes
    const staticResults = searchAllPalettes(searchQuery);
    
    const dbResults = dbPalettes.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) || 
      p.tags.some(t => t.toLowerCase().includes(lowerQuery)) ||
      p.colors.some(c => c.toLowerCase().includes(lowerQuery))
    );
    
    return [...dbResults, ...staticResults];
  }, [searchQuery, isInitialized, loading]); // loading dependency ensures updates after loadMore

  // STABLE callback - never changes reference
  const handleOpenModal = useCallback((palette: Palette) => {
    setSelectedPalette(palette);
  }, []);

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
            : `${(staticPalettesRef.current.length + dbPalettesRef.current.length).toLocaleString()} / ${(total + dbPalettesRef.current.length).toLocaleString()} loaded`
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

        {filteredPalettes.length === 0 && isInitialized && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg text-muted-foreground">No palettes found</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different search term</p>
          </div>
        )}
        
        {!isInitialized && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
