import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  Copy,
  Lock,
  Unlock,
  RefreshCw,
  Save,
  MessageCircle,
  PanelLeftOpen,
  PanelRightOpen,
  Sparkles,
  Wand2,
  MoveLeft,
  MoveRight,
  Palette as PaletteIcon,
  Search,
  ListFilter,
} from "lucide-react";
import { toast } from "sonner";
import { getRandomPalette, generateRandomColors } from "@/data/palettes";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface ColorSlot {
  color: string;
  locked: boolean;
}

interface ProPaletteBuilderProps {
  onBrowse: () => void;
  onHome?: () => void;
  onOldDesign: () => void;
}

type ChatMode = "ask" | "edit";

const DEFAULT_COLORS = getRandomPalette();

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

function hexToHsl(hex: string) {
  const parsed = hex.replace("#", "");
  const r = parseInt(parsed.substring(0, 2), 16) / 255;
  const g = parseInt(parsed.substring(2, 4), 16) / 255;
  const b = parseInt(parsed.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  };
}

function hslToHex({ h, s, l }: { h: number; s: number; l: number }) {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

export function ProPaletteBuilder({
  onBrowse,
  onHome,
  onOldDesign,
}: ProPaletteBuilderProps) {
  const [colorSlots, setColorSlots] = useState<ColorSlot[]>(
    DEFAULT_COLORS.map((c) => ({ color: c, locked: false }))
  );
  const [selected, setSelected] = useState<number>(0);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [chatMode, setChatMode] = useState<ChatMode>("edit");
  const [isDesktop, setIsDesktop] = useState<boolean>(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    setIsChatOpen(mq.matches);
    const handler = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
      setIsChatOpen(e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const selectedSlot = colorSlots[selected] ?? colorSlots[0];

  const regenerate = useCallback(() => {
    setColorSlots((prev) => {
      const fresh = getRandomPalette();
      const fallback = generateRandomColors(prev.length);
      return prev.map((slot, idx) => {
        if (slot.locked) return slot;
        const next =
          fresh[idx] ?? fallback[idx] ?? generateRandomColors(1)[0] ?? slot.color;
        return { ...slot, color: next };
      });
    });
    toast.success("Generated new palette (locked colors kept)", {
      duration: 1500,
    });
  }, []);

  const moveSlot = useCallback(
    (direction: -1 | 1) => {
      setColorSlots((prev) => {
        if (selected === null || selected < 0 || selected >= prev.length)
          return prev;
        const target = selected + direction;
        if (target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        [next[selected], next[target]] = [next[target], next[selected]];
        setSelected(target);
        return next;
      });
    },
    [selected]
  );

  const toggleLock = useCallback(() => {
    if (selected === null) return;
    setColorSlots((prev) =>
      prev.map((slot, idx) =>
        idx === selected ? { ...slot, locked: !slot.locked } : slot
      )
    );
  }, [selected]);

  const copyColor = useCallback(() => {
    if (!selectedSlot) return;
    navigator.clipboard.writeText(selectedSlot.color);
    toast.success(`Copied ${selectedSlot.color}`);
  }, [selectedSlot]);

  const copyPalette = useCallback(() => {
    const json = JSON.stringify(colorSlots.map((c) => c.color));
    navigator.clipboard.writeText(json);
    toast.success("Copied palette JSON");
  }, [colorSlots]);

  const copyPaletteCsv = useCallback(() => {
    navigator.clipboard.writeText(colorSlots.map((c) => c.color).join(","));
    toast.success("Copied palette CSV");
  }, [colorSlots]);

  const savePalette = useCallback(async () => {
    const { data: { session } = { session: null } } =
      await supabase.auth.getSession();
    if (!session) {
      toast.info("Sign in to save palettes.");
      return;
    }
    const name = `Manual palette ${new Date().toLocaleDateString()}`;
    const { error } = await supabase.from("public_palettes").insert({
      name,
      colors: colorSlots.map((c) => c.color),
      tags: ["manual", "pro-builder"],
      created_by: session.user.id,
    });
    if (error) {
      toast.error("Failed to save palette");
      return;
    }
    toast.success("Palette saved");
  }, [colorSlots]);

  const setColorAt = useCallback((index: number, color: string) => {
    setColorSlots((prev) =>
      prev.map((slot, idx) => (idx === index ? { ...slot, color } : slot))
    );
  }, []);

  const adjustColor = (hex: string, intent: "warmer" | "cooler" | "pastel" | "contrast") => {
    const hsl = hexToHsl(hex);
    switch (intent) {
      case "warmer":
        hsl.h = (hsl.h + 12) % 360;
        break;
      case "cooler":
        hsl.h = (hsl.h - 12 + 360) % 360;
        break;
      case "pastel":
        hsl.s = clamp(hsl.s - 15);
        hsl.l = clamp(hsl.l + 8);
        break;
      case "contrast":
        hsl.s = clamp(hsl.s + 12);
        hsl.l = clamp(hsl.l + (hsl.l < 50 ? -5 : 5));
        break;
    }
    return hslToHex(hsl);
  };

  const applyAdjustment = useCallback(
    (intent: "warmer" | "cooler" | "pastel" | "contrast", scope: "selected" | "all") => {
      if (!selectedSlot && scope === "selected") {
        toast.info("Select a color first.");
        return;
      }
      setColorSlots((prev) =>
        prev.map((slot, idx) => {
          const affects = scope === "all" ? true : idx === selected;
          if (!affects) return slot;
          return { ...slot, color: adjustColor(slot.color, intent) };
        })
      );
      toast.success(
        `${scope === "all" ? "Palette" : "Color"} updated (${intent})`,
        { duration: 1200 }
      );
    },
    [selected, selectedSlot]
  );

  const handlePaletteClick = (index: number) => {
    setSelected(index);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        regenerate();
      }
      if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        toggleLock();
      }
      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        copyColor();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [regenerate, toggleLock, copyColor]);

  const contrastColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#FFFFFF";
  };

  const sidebarContent = (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Resources</span>
        </div>
        <Input placeholder="Search…" className="bg-muted border-border" />
        <div className="grid grid-cols-2 gap-2 text-sm">
          {["Palettes", "Colors", "Templates", "Assets"].map((label) => (
            <div
              key={label}
              className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Coming soon</p>
          <div className="space-y-2">
            <div className="rounded-lg bg-muted/50 border border-dashed border-border px-3 py-2">
              Template presets
            </div>
            <div className="rounded-lg bg-muted/50 border border-dashed border-border px-3 py-2">
              Asset library
            </div>
            <div className="rounded-lg bg-muted/50 border border-dashed border-border px-3 py-2">
              Brand kits
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );

  const chatContent = (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-semibold">Chat</p>
            <p className="text-xs text-muted-foreground">
              Ask or apply edits to your palette
            </p>
          </div>
        </div>
        {!isDesktop && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsChatOpen(false)}
          >
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
      <Tabs value={chatMode} onValueChange={(v) => setChatMode(v as ChatMode)}>
        <TabsList className="grid grid-cols-2 m-4">
          <TabsTrigger value="ask">Ask mode</TabsTrigger>
          <TabsTrigger value="edit">Edit mode</TabsTrigger>
        </TabsList>
        <TabsContent value="ask" className="px-4 pb-4">
          <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground space-y-2">
            <p>Chat replies coming soon.</p>
            <p>Try: “Suggest a name for this palette.”</p>
          </div>
        </TabsContent>
        <TabsContent value="edit" className="px-4 pb-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Quick edits apply to the {selected !== null ? "selected color" : "palette"}.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => applyAdjustment("warmer", selected !== null ? "selected" : "all")}
            >
              Warmer
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => applyAdjustment("cooler", selected !== null ? "selected" : "all")}
            >
              Cooler
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => applyAdjustment("pastel", selected !== null ? "selected" : "all")}
            >
              Pastel
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => applyAdjustment("contrast", selected !== null ? "selected" : "all")}
            >
              More contrast
            </Button>
          </div>
          <Separator />
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>Scope</p>
            <div className="flex gap-2">
              <Button
                variant={selected !== null ? "secondary" : "outline"}
                size="sm"
                onClick={() => applyAdjustment("warmer", "selected")}
              >
                Selected color
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyAdjustment("warmer", "all")}
              >
                Whole palette
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border bg-card/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="gap-2 px-2"
            onClick={onHome}
          >
            <PaletteIcon className="w-5 h-5 text-primary" />
            <span className="font-display font-semibold">Colored In</span>
          </Button>
          <span className="text-sm text-muted-foreground hidden sm:block">
            Pro Manual Builder
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onOldDesign}>
            Old builder
          </Button>
          <Button variant="outline" size="sm" onClick={onBrowse}>
            Browse palettes
          </Button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_1fr_auto] overflow-hidden">
        <div className="hidden lg:block border-r border-border bg-card">
          {sidebarContent}
        </div>

        <div className="relative flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/70 backdrop-blur">
            <div className="flex items-center gap-2">
              {!isDesktop && (
                <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <PanelLeftOpen className="w-4 h-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-80">
                    <SheetHeader className="p-4 border-b border-border">
                      <SheetTitle>Tools</SheetTitle>
                    </SheetHeader>
                    {sidebarContent}
                  </SheetContent>
                </Sheet>
              )}
              <div>
                <p className="text-sm font-semibold">Palette</p>
                <p className="text-xs text-muted-foreground">
                  Click to select, hover to copy
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isDesktop && (
                <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="p-0 w-96">
                    {chatContent}
                  </SheetContent>
                </Sheet>
              )}
              {isDesktop && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsChatOpen((v) => !v)}
                >
                  {isChatOpen ? (
                    <PanelRightOpen className="w-4 h-4" />
                  ) : (
                    <MessageCircle className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex">
              <div className="flex-1 flex gap-0 overflow-hidden">
                {colorSlots.map((slot, idx) => {
                  const isSelected = idx === selected;
                  const textColor = contrastColor(slot.color);
                  return (
                    <div
                      key={idx}
                      className={`relative flex-1 min-w-[120px] transition-all duration-200 cursor-pointer ${
                        isSelected ? "ring-4 ring-primary ring-inset" : ""
                      }`}
                      style={{ backgroundColor: slot.color }}
                      onClick={() => handlePaletteClick(idx)}
                    >
                      <div className="absolute inset-0 flex flex-col justify-center items-center gap-3 text-center">
                        <div
                          className="text-lg font-semibold font-mono px-3 py-1 rounded-full bg-black/20 backdrop-blur-sm"
                          style={{ color: textColor }}
                        >
                          {slot.color}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="bg-black/25 text-white border-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(slot.color);
                              toast.success(`Copied ${slot.color}`);
                            }}
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            Copy
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="bg-black/25 text-white border-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setColorAt(idx, adjustColor(slot.color, "pastel"));
                            }}
                          >
                            <Wand2 className="w-4 h-4 mr-1" />
                            Tweak
                          </Button>
                        </div>
                      </div>
                      {slot.locked && (
                        <div
                          className="absolute top-4 right-4 rounded-full px-3 py-1 text-xs font-medium bg-black/30 backdrop-blur-sm"
                          style={{ color: textColor }}
                        >
                          <Lock className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {isDesktop && isChatOpen && (
                <aside className="w-80 border-l border-border bg-card/70 backdrop-blur">
                  {chatContent}
                </aside>
              )}
            </div>

            <footer className="border-t border-border bg-card/80 backdrop-blur px-4 py-3">
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => moveSlot(-1)}
                  disabled={selected <= 0}
                >
                  <MoveLeft className="w-4 h-4 mr-2" />
                  Move left
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => moveSlot(1)}
                  disabled={selected >= colorSlots.length - 1}
                >
                  <MoveRight className="w-4 h-4 mr-2" />
                  Move right
                </Button>
                <Button
                  variant={selectedSlot?.locked ? "secondary" : "outline"}
                  size="sm"
                  onClick={toggleLock}
                >
                  {selectedSlot?.locked ? (
                    <>
                      <Unlock className="w-4 h-4 mr-2" />
                      Unlock
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Lock
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={copyColor}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy color (C)
                </Button>
                <Button variant="outline" size="sm" onClick={copyPalette}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy JSON
                </Button>
                <Button variant="outline" size="sm" onClick={copyPaletteCsv}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy CSV
                </Button>
                <Button variant="outline" size="sm" onClick={savePalette}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <div className="ml-auto flex gap-2">
                  <Button onClick={regenerate}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate (Space)
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => applyAdjustment("pastel", "all")}
                  >
                    <ArrowLeftRight className="w-4 h-4 mr-2" />
                    Harmonize
                  </Button>
                </div>
              </div>
            </footer>
          </div>
        </div>

      </div>
    </div>
  );
}
