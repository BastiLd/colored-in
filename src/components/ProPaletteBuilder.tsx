import { useState, useCallback, useEffect, useMemo } from "react";
import { 
  Copy, 
  Lock, 
  Unlock, 
  RefreshCw, 
  ChevronRight, 
  Save, 
  X, 
  Plus,
  Palette as PaletteIcon,
  Sparkles,
  Droplets,
  Search,
  ChevronLeft
} from "lucide-react";
import { toast } from "sonner";
import { getRandomPalette, generateRandomColors, getFreePalettes, Palette } from "@/data/palettes";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ColorSlot {
  color: string;
  locked: boolean;
}

interface ProPaletteBuilderProps {
  onBrowse: () => void;
  onHome?: () => void;
  onOldDesign: () => void;
}

type SidebarTab = "palettes" | "ai" | "colors" | null;

export function ProPaletteBuilder({ onBrowse, onHome, onOldDesign }: ProPaletteBuilderProps) {
  const [colorSlots, setColorSlots] = useState<ColorSlot[]>(() => 
    getRandomPalette().map(color => ({ color, locked: false }))
  );
  const [activeTab, setActiveTab] = useState<SidebarTab>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [customColor, setCustomColor] = useState("#6366F1");
  const [showAutoFillPopup, setShowAutoFillPopup] = useState(false);
  const [autoFillPrompt, setAutoFillPrompt] = useState("");
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);

  const allPalettes = useMemo(() => getFreePalettes(), []);
  
  const filteredPalettes = useMemo(() => {
    if (!searchQuery.trim()) return allPalettes.slice(0, 100);
    const query = searchQuery.toLowerCase();
    return allPalettes
      .filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.tags.some(t => t.toLowerCase().includes(query))
      )
      .slice(0, 100);
  }, [allPalettes, searchQuery]);

  const generateNewPalette = useCallback(() => {
    const newColors = Math.random() > 0.3 ? getRandomPalette() : generateRandomColors();
    setColorSlots(prev => 
      prev.map((slot, i) => 
        slot.locked ? slot : { color: newColors[i] || generateRandomColors(1)[0], locked: false }
      )
    );
  }, []);

  const toggleLock = useCallback((index: number) => {
    setColorSlots(prev => 
      prev.map((slot, i) => 
        i === index ? { ...slot, locked: !slot.locked } : slot
      )
    );
  }, []);

  const copyColor = useCallback((color: string) => {
    navigator.clipboard.writeText(color);
    toast.success(`Copied ${color}`, { duration: 1500, position: "bottom-center" });
  }, []);

  const copyAllColors = useCallback(() => {
    const colors = colorSlots.map(s => s.color).join(", ");
    navigator.clipboard.writeText(colors);
    toast.success("Copied all colors!", { duration: 1500, position: "bottom-center" });
  }, [colorSlots]);

  const lockedColors = colorSlots.filter(s => s.locked).map(s => s.color);
  const canSave = lockedColors.length >= 3;

  const savePalette = useCallback(async () => {
    if (!canSave) {
      toast.error("Lock at least 3 colors to save", { duration: 2000 });
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please log in to save palettes", { duration: 2000 });
      return;
    }

    const paletteName = `Custom ${new Date().toLocaleDateString()}`;
    
    const { error } = await supabase
      .from("public_palettes")
      .insert({
        name: paletteName,
        colors: lockedColors,
        tags: ["custom", "user-created"],
        created_by: session.user.id
      });

    if (error) {
      toast.error("Failed to save palette", { duration: 2000 });
      return;
    }

    toast.success(`Saved palette with ${lockedColors.length} colors!`, { duration: 2000, position: "bottom-center" });
  }, [canSave, lockedColors]);

  const removeSlot = useCallback((index: number) => {
    if (colorSlots.length <= 2) {
      toast.error("Minimum 2 colors required", { duration: 1500 });
      return;
    }
    setColorSlots(prev => prev.filter((_, i) => i !== index));
  }, [colorSlots.length]);

  const addSlot = useCallback((position: "start" | "end") => {
    if (colorSlots.length >= 10) {
      toast.error("Maximum 10 colors allowed", { duration: 1500 });
      return;
    }
    const newColor = generateRandomColors(1)[0];
    setColorSlots(prev => 
      position === "start" 
        ? [{ color: newColor, locked: false }, ...prev]
        : [...prev, { color: newColor, locked: false }]
    );
  }, [colorSlots.length]);

  const applyPalette = useCallback((palette: Palette) => {
    setColorSlots(palette.colors.map(color => ({ color, locked: false })));
    setActiveTab(null);
    toast.success(`Applied "${palette.name}"`, { duration: 1500 });
  }, []);

  const handleColorSlotClick = useCallback((index: number) => {
    if (activeTab === "colors") {
      setSelectedSlotIndex(index);
    } else {
      copyColor(colorSlots[index].color);
    }
  }, [activeTab, colorSlots, copyColor]);

  const applyCustomColor = useCallback(() => {
    if (selectedSlotIndex !== null) {
      setColorSlots(prev => 
        prev.map((slot, i) => 
          i === selectedSlotIndex ? { ...slot, color: customColor } : slot
        )
      );
      setShowAutoFillPopup(true);
    }
  }, [selectedSlotIndex, customColor]);

  const handleAutoFill = useCallback(async () => {
    toast.success("AI Auto-fill coming soon!", { duration: 2000 });
    setShowAutoFillPopup(false);
    setAutoFillPrompt("");
  }, []);

  const handleTabClick = useCallback((tab: SidebarTab) => {
    setActiveTab(prev => prev === tab ? null : tab);
    setSelectedSlotIndex(null);
    setShowAutoFillPopup(false);
  }, []);

  const handleMainAreaClick = useCallback(() => {
    if (activeTab === "palettes" || activeTab === "ai") {
      setActiveTab(null);
    }
  }, [activeTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        generateNewPalette();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [generateNewPalette]);

  const getContrastColor = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#FFFFFF";
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-card border-b border-border z-20">
        <button 
          onClick={onHome}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <h1 className="text-xl font-bold text-gradient font-display">Colored In</h1>
        </button>
        
        <div className="flex items-center gap-3">
          <button
            onClick={onOldDesign}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
          >
            Old Design
          </button>

          <button
            onClick={savePalette}
            disabled={!canSave}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              canSave 
                ? "text-primary-foreground bg-primary hover:opacity-90 glow-primary" 
                : "text-muted-foreground bg-muted cursor-not-allowed"
            }`}
            title={canSave ? "Save locked colors as palette" : "Lock at least 3 colors to save"}
          >
            <Save className="w-4 h-4" />
            Save ({lockedColors.length}/3+)
          </button>

          <button
            onClick={copyAllColors}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-secondary-foreground bg-secondary hover:bg-muted rounded-lg transition-colors"
          >
            <Copy className="w-4 h-4" />
            Export
          </button>
          
          <button
            onClick={onBrowse}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-all glow-primary"
          >
            Browse Palettes
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Icon Sidebar */}
        <div className="w-16 bg-card border-r border-border flex flex-col items-center py-4 gap-2 z-10">
          <button
            onClick={() => handleTabClick("palettes")}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
              activeTab === "palettes" 
                ? "bg-primary text-primary-foreground" 
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
            title="Palettes"
          >
            <PaletteIcon className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => handleTabClick("ai")}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
              activeTab === "ai" 
                ? "bg-primary text-primary-foreground" 
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
            title="AI Generator"
          >
            <Sparkles className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => handleTabClick("colors")}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
              activeTab === "colors" 
                ? "bg-primary text-primary-foreground" 
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
            title="Colors"
          >
            <Droplets className="w-5 h-5" />
          </button>
        </div>

        {/* Expandable Panel */}
        <div 
          className={`bg-card border-r border-border transition-all duration-300 overflow-hidden z-10 ${
            activeTab && activeTab !== "colors" ? "w-80" : "w-0"
          }`}
        >
          {activeTab === "palettes" && (
            <div className="w-80 h-full flex flex-col">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold mb-3">Palettes</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {filteredPalettes.map((palette) => (
                    <button
                      key={palette.id}
                      onClick={() => applyPalette(palette)}
                      className="w-full p-3 bg-muted/50 hover:bg-muted rounded-xl transition-colors text-left group"
                    >
                      <div className="flex h-8 rounded-lg overflow-hidden mb-2">
                        {palette.colors.map((color, i) => (
                          <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                        ))}
                      </div>
                      <p className="text-sm font-medium truncate">{palette.name}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {palette.tags.slice(0, 2).map((tag, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-background rounded-full text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="w-80 h-full flex flex-col p-4">
              <h3 className="font-semibold mb-3">AI Generator</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Describe your desired color palette and the AI will create it for you.
              </p>
              <textarea
                placeholder="e.g. 'Sunset over the ocean' or 'Modern tech startup'"
                className="flex-1 p-3 bg-muted border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                rows={4}
              />
              <button className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                Generate
              </button>
            </div>
          )}
        </div>

        {/* Main Color Area */}
        <div className="flex-1 flex relative" onClick={handleMainAreaClick}>
          {/* Add Button - Start */}
          <button
            onClick={(e) => { e.stopPropagation(); addSlot("start"); }}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-16 bg-card/80 hover:bg-card border border-border rounded-r-lg flex items-center justify-center transition-all hover:w-10 group"
          >
            <Plus className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          </button>

          {/* Color Slots */}
          {colorSlots.map((slot, index) => (
            <div
              key={index}
              className={`flex-1 relative group cursor-pointer transition-all duration-200 ${
                hoveredSlot === index ? "flex-[1.15]" : ""
              } ${selectedSlotIndex === index ? "ring-4 ring-primary ring-inset" : ""}`}
              style={{ backgroundColor: slot.color }}
              onClick={(e) => { e.stopPropagation(); handleColorSlotClick(index); }}
              onMouseEnter={() => setHoveredSlot(index)}
              onMouseLeave={() => setHoveredSlot(null)}
            >
              {/* Remove Button */}
              {hoveredSlot === index && colorSlots.length > 2 && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeSlot(index); }}
                  className="absolute top-4 right-4 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors z-10"
                  style={{ color: getContrastColor(slot.color) }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Color Info */}
              <div 
                className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-8 transition-opacity"
                style={{ color: getContrastColor(slot.color) }}
              >
                <span className="font-mono text-sm font-medium tracking-wider opacity-80 group-hover:opacity-100">
                  {slot.color}
                </span>
              </div>

              {/* Actions */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); copyColor(slot.color); }}
                  className="p-3 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-colors"
                  style={{ color: getContrastColor(slot.color) }}
                >
                  <Copy className="w-5 h-5" />
                </button>
                
                <button
                  onClick={(e) => { e.stopPropagation(); toggleLock(index); }}
                  className="p-3 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-colors"
                  style={{ color: getContrastColor(slot.color) }}
                >
                  {slot.locked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                </button>
              </div>

              {/* Lock indicator */}
              {slot.locked && (
                <div 
                  className="absolute top-4 left-1/2 -translate-x-1/2"
                  style={{ color: getContrastColor(slot.color) }}
                >
                  <Lock className="w-4 h-4" />
                </div>
              )}

              {/* Color Selection Mode Indicator */}
              {activeTab === "colors" && selectedSlotIndex !== index && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <span 
                    className="text-sm font-medium px-3 py-1 rounded-full bg-black/20 backdrop-blur-sm"
                    style={{ color: getContrastColor(slot.color) }}
                  >
                    Click to select
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* Add Button - End */}
          <button
            onClick={(e) => { e.stopPropagation(); addSlot("end"); }}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-16 bg-card/80 hover:bg-card border border-border rounded-l-lg flex items-center justify-center transition-all hover:w-10 group"
          >
            <Plus className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          </button>

          {/* Color Picker Panel */}
          {activeTab === "colors" && (
            <div className="absolute right-4 top-4 w-64 bg-card border border-border rounded-xl shadow-2xl p-4 z-20">
              <h4 className="font-semibold mb-3">Custom Color</h4>
              {selectedSlotIndex !== null ? (
                <>
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-full h-32 rounded-lg cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-full mt-2 px-3 py-2 bg-muted border border-border rounded-lg text-sm font-mono text-center"
                  />
                  <button
                    onClick={applyCustomColor}
                    className="w-full mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Apply
                  </button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a color block to change its color.
                </p>
              )}
            </div>
          )}

          {/* Auto-fill Popup */}
          {showAutoFillPopup && (
            <div className="absolute right-4 top-4 w-72 bg-card border border-border rounded-xl shadow-2xl p-4 z-30 animate-in fade-in slide-in-from-top-2">
              <h4 className="font-semibold mb-2">Auto-fill remaining colors?</h4>
              <p className="text-sm text-muted-foreground mb-3">
                The AI will generate matching colors for the other blocks.
              </p>
              <input
                type="text"
                placeholder="Optional: Enter description..."
                value={autoFillPrompt}
                onChange={(e) => setAutoFillPrompt(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAutoFillPopup(false)}
                  className="flex-1 px-3 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm"
                >
                  No
                </button>
                <button
                  onClick={handleAutoFill}
                  className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm flex items-center justify-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Yes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-center px-6 py-4 bg-card border-t border-border">
        <button
          onClick={generateNewPalette}
          className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-all glow-primary"
        >
          <RefreshCw className="w-4 h-4" />
          Generate
          <span className="ml-2 px-2 py-0.5 text-xs bg-primary-foreground/20 rounded">Space</span>
        </button>
      </footer>
    </div>
  );
}
