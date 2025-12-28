import { useState, useCallback, useEffect } from "react";
import { Copy, Lock, Unlock, RefreshCw, ChevronRight, Save } from "lucide-react";
import { toast } from "sonner";
import { getRandomPalette, generateRandomColors } from "@/data/palettes";
import { supabase } from "@/integrations/supabase/client";

interface ColorSlot {
  color: string;
  locked: boolean;
}

interface PaletteGeneratorProps {
  onBrowse: () => void;
  onHome?: () => void;
  onNewDesign?: () => void;
  showNewDesignButton?: boolean;
}

export function PaletteGenerator({ onBrowse, onHome, onNewDesign, showNewDesignButton }: PaletteGeneratorProps) {
  const [colorSlots, setColorSlots] = useState<ColorSlot[]>(() => 
    getRandomPalette().map(color => ({ color, locked: false }))
  );

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
    toast.success(`Copied ${color}`, {
      duration: 1500,
      position: "bottom-center",
    });
  }, []);

  const copyAllColors = useCallback(() => {
    const colors = colorSlots.map(s => s.color).join(", ");
    navigator.clipboard.writeText(colors);
    toast.success("Copied all colors!", {
      duration: 1500,
      position: "bottom-center",
    });
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

    toast.success(`Saved palette with ${lockedColors.length} colors!`, {
      duration: 2000,
      position: "bottom-center",
    });
  }, [canSave, lockedColors]);

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
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-card border-b border-border">
        <button 
          onClick={onHome}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <h1 className="text-xl font-bold text-gradient font-display">Colored In</h1>
        </button>
        
        <div className="flex items-center gap-3">
          {showNewDesignButton && (
            <button
              onClick={onNewDesign}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
            >
              New Builder
            </button>
          )}

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

      {/* Color Strips */}
      <div className="flex-1 flex">
        {colorSlots.map((slot, index) => (
          <div
            key={index}
            className="flex-1 relative group cursor-pointer transition-all duration-200 hover:flex-[1.1]"
            style={{ backgroundColor: slot.color }}
            onClick={() => copyColor(slot.color)}
          >
            {/* Color Info - Always visible */}
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
                onClick={(e) => {
                  e.stopPropagation();
                  copyColor(slot.color);
                }}
                className="p-3 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-colors"
                style={{ color: getContrastColor(slot.color) }}
              >
                <Copy className="w-5 h-5" />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLock(index);
                }}
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
          </div>
        ))}
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
