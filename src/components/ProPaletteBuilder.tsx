import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Copy,
  Lock,
  Unlock,
  RefreshCw,
  Save,
  MessageCircle,
  PanelLeftOpen,
  PanelRightOpen,
  MoveLeft,
  MoveRight,
  Palette as PaletteIcon,
  Search,
  ListFilter,
  Send,
  Droplets,
  Image,
  Loader2,
  X,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { getRandomPalette, generateRandomColors, getFreePalettes, type Palette } from "@/data/palettes";
import { supabase } from "@/integrations/supabase/client";
import { getPlanLimits } from "@/lib/planLimits";
import { AssetsPanel } from "@/components/AssetsPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

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
type SidebarTab = "palettes" | "colors" | "assets";
type EditScope = "selected" | "all";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const PREDEFINED_TAGS = ["Warm", "Cool", "Pastel", "Vibrant", "Monochrome", "Contrast", "Nature", "Modern"];

const DEFAULT_COLORS = getRandomPalette();

const TOAST_POSITION = "top-center" as const;

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

// Color theory tips for Ask mode
const COLOR_TIPS = [
  "Complementary colors are opposite on the color wheel and create high contrast.",
  "Analogous colors are next to each other on the color wheel and create harmony.",
  "Split-complementary uses one base color and two colors adjacent to its complement.",
  "Triadic colors are evenly spaced on the color wheel (120° apart).",
  "Use 60-30-10 rule: 60% dominant color, 30% secondary, 10% accent.",
  "Warm colors (red, orange, yellow) feel energetic. Cool colors (blue, green, purple) feel calm.",
  "High saturation = vibrant and bold. Low saturation = muted and sophisticated.",
  "Increase contrast for readability. Light text on dark background or vice versa.",
];

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
  
  // New states for fixes
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("palettes");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editScope, setEditScope] = useState<EditScope>("selected");
  const [chatInput, setChatInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  // Chat functionality states
  const [chatLimit, setChatLimit] = useState<number>(0);
  const [chatUsed, setChatUsed] = useState<number>(0);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [userId, setUserId] = useState<string | null>(null);
  const chatPanelRef = useRef<ImperativePanelHandle>(null);

  // Save modal states
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savePaletteName, setSavePaletteName] = useState("");
  const [savePaletteTags, setSavePaletteTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  
  // Primary color modal states
  const [showPrimaryColorModal, setShowPrimaryColorModal] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#3B82F6");
  
  // Tag filter state
  const [selectedTagsFilter, setSelectedTagsFilter] = useState<string[]>([]);

  // Get palettes for sidebar (searchable + scrollable through all palettes)
  const allPalettes = useMemo(() => getFreePalettes(), []);
  
  const filteredPalettes = useMemo(() => {
    let result = allPalettes;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.tags.some(t => t.toLowerCase().includes(query))
      );
    }
    
    // Filter by selected tags
    if (selectedTagsFilter.length > 0) {
      result = result.filter(p =>
        selectedTagsFilter.some(tag => p.tags.includes(tag))
      );
    }
    
    return result;
  }, [allPalettes, searchQuery, selectedTagsFilter]);

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

  useEffect(() => {
    if (!isDesktop) return;
    if (!chatPanelRef.current) return;
    if (isChatOpen) {
      chatPanelRef.current.expand();
    } else {
      chatPanelRef.current.collapse();
    }
  }, [isChatOpen, isDesktop]);

  // Fetch user's plan and usage limits on mount
  useEffect(() => {
    const fetchUsageAndHistory = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setUserId(session.user.id);

      // Get user's plan
      const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('plan, is_active')
        .eq('user_id', session.user.id)
        .single();
      
      const plan = (sub?.is_active && sub?.plan) || 'free';
      setUserPlan(plan);
      
      const planLimits = getPlanLimits(plan);
      setChatLimit(planLimits.chatMessagesPerMonth);
      
      // Get usage count
      const { data: usage } = await supabase
        .from('user_ai_usage')
        .select('chat_messages_count')
        .eq('user_id', session.user.id)
        .single();
      
      setChatUsed(usage?.chat_messages_count || 0);

      // Load chat history if enabled
      const { data: settings } = await supabase
        .from('user_settings')
        .select('save_chat_history')
        .eq('user_id', session.user.id)
        .single();

      if (settings?.save_chat_history) {
        const { data: history } = await supabase
          .from('user_chat_history')
          .select('role, content')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: true })
          .limit(20);

        if (history && history.length > 0) {
          setChatMessages(history as ChatMessage[]);
        }
      }
    };

    fetchUsageAndHistory();
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
    toast.success("New palette generated", {
      duration: 1500,
      position: TOAST_POSITION,
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
    toast.success(`Copied ${selectedSlot.color}`, { position: TOAST_POSITION });
  }, [selectedSlot]);

  const copyPalette = useCallback(() => {
    const json = JSON.stringify(colorSlots.map((c) => c.color));
    navigator.clipboard.writeText(json);
    toast.success("Copied palette JSON", { position: TOAST_POSITION });
  }, [colorSlots]);

  const copyPaletteCsv = useCallback(() => {
    navigator.clipboard.writeText(colorSlots.map((c) => c.color).join(","));
    toast.success("Copied palette CSV", { position: TOAST_POSITION });
  }, [colorSlots]);

  const openSaveModal = useCallback(() => {
    setShowSaveModal(true);
    setSavePaletteName(`Manual palette ${new Date().toLocaleDateString()}`);
    setSavePaletteTags([]);
    setCustomTag("");
  }, []);

  const savePaletteWithName = useCallback(async () => {
    const { data: { session } = { session: null } } =
      await supabase.auth.getSession();
    if (!session) {
      toast.info("Sign in to save palettes.", { position: TOAST_POSITION });
      return;
    }
    
    if (!savePaletteName.trim()) {
      toast.error("Please enter a palette name", { position: TOAST_POSITION });
      return;
    }
    
    const { error } = await supabase.from("public_palettes").insert({
      name: savePaletteName,
      colors: colorSlots.map((c) => c.color),
      tags: [...savePaletteTags, "manual", "pro-builder"],
      created_by: session.user.id,
    });
    
    if (error) {
      toast.error("Failed to save palette", { position: TOAST_POSITION });
      return;
    }
    
    toast.success("Palette saved!", { position: TOAST_POSITION });
    setShowSaveModal(false);
  }, [colorSlots, savePaletteName, savePaletteTags]);

  const savePalette = openSaveModal;

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

  // Real harmonize function - pulls all colors towards selected color's hue family
  const harmonizePalette = useCallback(() => {
    if (selected === null || !selectedSlot) {
      toast.info("Select a base color first", { position: TOAST_POSITION });
      return;
    }
    
    const baseHsl = hexToHsl(selectedSlot.color);
    
    setColorSlots((prev) =>
      prev.map((slot, idx) => {
        if (slot.locked || idx === selected) return slot;
        
        const currentHsl = hexToHsl(slot.color);
        
        // Pull hue 60% towards base color
        const hueDiff = baseHsl.h - currentHsl.h;
        let newHue = currentHsl.h + (hueDiff * 0.6);
        
        // Add variation based on position for interest
        const variation = (idx - selected) * 10;
        newHue = (newHue + variation + 360) % 360;
        
        // Slightly adjust saturation/lightness towards base
        const newSat = currentHsl.s + (baseHsl.s - currentHsl.s) * 0.3;
        const newLight = currentHsl.l + (baseHsl.l - currentHsl.l) * 0.2;
        
        return {
          ...slot,
          color: hslToHex({
            h: newHue,
            s: clamp(newSat, 10, 100),
            l: clamp(newLight, 15, 90),
          }),
        };
      })
    );
    
    toast.success("Palette harmonized", { duration: 1500, position: TOAST_POSITION });
  }, [selected, selectedSlot]);

  const applyAdjustment = useCallback(
    (intent: "warmer" | "cooler" | "pastel" | "contrast") => {
      const scope = editScope;
      if (scope === "selected" && !selectedSlot) {
        toast.info("Select a color first.", { position: TOAST_POSITION });
        return;
      }
      
      if (scope === "all" && selected !== null && selectedSlot) {
        // When "Whole palette" is selected, harmonize based on selected color
        const baseHsl = hexToHsl(selectedSlot.color);
        
        setColorSlots((prev) =>
          prev.map((slot, idx) => {
            if (slot.locked) return slot;
            
            const currentHsl = hexToHsl(slot.color);
            
            // Apply the adjustment
            let adjustedHsl = { ...currentHsl };
            
            switch (intent) {
              case "warmer":
                // Shift hue towards warmer (red/orange direction)
                adjustedHsl.h = (adjustedHsl.h + 15) % 360;
                // Pull colors closer to base color's warmth for harmony
                const warmthDiff = baseHsl.h - adjustedHsl.h;
                adjustedHsl.h = (adjustedHsl.h + warmthDiff * 0.2 + 360) % 360; // 20% shift towards base
                break;
              case "cooler":
                // Shift hue towards cooler (blue/green direction)
                adjustedHsl.h = (adjustedHsl.h - 15 + 360) % 360;
                const coolDiff = baseHsl.h - adjustedHsl.h;
                adjustedHsl.h = (adjustedHsl.h + coolDiff * 0.2 + 360) % 360;
                break;
              case "pastel":
                adjustedHsl.s = clamp(adjustedHsl.s - 20);
                adjustedHsl.l = clamp(adjustedHsl.l + 15);
                // Harmonize saturation slightly towards base
                const satDiff = baseHsl.s - adjustedHsl.s;
                adjustedHsl.s = clamp(adjustedHsl.s + satDiff * 0.15);
                break;
              case "contrast":
                adjustedHsl.s = clamp(adjustedHsl.s + 15);
                adjustedHsl.l = clamp(adjustedHsl.l + (adjustedHsl.l < 50 ? -10 : 10));
                break;
            }
            
            return { ...slot, color: hslToHex(adjustedHsl) };
          })
        );
      } else {
        // Apply to selected color only
        setColorSlots((prev) =>
          prev.map((slot, idx) => {
            if (idx !== selected) return slot;
            return { ...slot, color: adjustColor(slot.color, intent) };
          })
        );
      }
      
      toast.success(
        `${scope === "all" ? "Palette" : "Color"} updated (${intent})`,
        { duration: 1200, position: TOAST_POSITION }
      );
    },
    [selected, selectedSlot, editScope]
  );

  const handlePaletteClick = (index: number) => {
    setSelected(index);
  };

  const applyPalette = useCallback((palette: Palette) => {
    setColorSlots(palette.colors.map(c => ({ color: c, locked: false })));
    toast.success(`Applied "${palette.name}"`, { duration: 1500, position: TOAST_POSITION });
  }, []);

  const handleAskSubmit = useCallback(async () => {
    if (!chatInput.trim()) return;
    
    // Check if user has access to Ask Mode
    const planLimits = getPlanLimits(userPlan);
    if (!planLimits.features.askMode) {
      toast.error("You need a Pro plan or higher to use Ask Mode", { position: TOAST_POSITION });
      return;
    }
    
    // Check if user has reached limit
    if (chatUsed >= chatLimit) {
      toast.error("You've reached your monthly Ask Mode limit. Upgrade your plan.", { position: TOAST_POSITION });
      return;
    }
    
    setIsLoadingChat(true);
    
    const userMessage: ChatMessage = { role: "user", content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to use Ask Mode", { position: TOAST_POSITION });
        setIsLoadingChat(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('ask-chat', {
        body: {
          question: chatInput,
          paletteContext: colorSlots.map(s => s.color)
        }
      });
      
      if (error) {
        console.error('Ask Mode error:', error);
        // Improve UX for expired/invalid sessions (common cause of 401/403)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const status = (error as any)?.context?.status as number | undefined;
        if (status === 401) {
          toast.error("Session expired. Please sign in again.", { position: TOAST_POSITION });
        } else if (status === 403) {
          toast.error("Access denied. Please check your plan or sign in again.", {
            position: TOAST_POSITION,
          });
        } else {
          toast.error(error.message || "Failed to get response", { position: TOAST_POSITION });
        }
        // Remove the user message we added optimistically
        setChatMessages(prev => prev.slice(0, -1));
      } else {
        const assistantMessage: ChatMessage = { 
          role: "assistant", 
          content: data.response 
        };
        setChatMessages(prev => [...prev, assistantMessage]);
        setChatUsed(data.usage?.used || chatUsed + 1);
        
        // Show remaining messages
        const remaining = chatLimit - (data.usage?.used || chatUsed + 1);
        if (remaining <= 5 && remaining > 0) {
          toast.info(`${remaining} chat messages remaining this month`, { position: TOAST_POSITION });
        }
      }
    } catch (err) {
      console.error('Ask Mode error:', err);
      toast.error("Failed to get response. Please try again.", { position: TOAST_POSITION });
      // Remove the user message we added optimistically
      setChatMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoadingChat(false);
    }
  }, [chatInput, colorSlots, userPlan, chatUsed, chatLimit]);

  // FIX: Only copy color when C is pressed WITHOUT Ctrl/Cmd
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        regenerate();
      }
      if (e.key.toLowerCase() === "l" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleLock();
      }
      // FIX: Only trigger copy color if Ctrl/Cmd is NOT pressed
      if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.metaKey) {
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
    <div className="h-full flex flex-col min-h-0">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Resources</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search palettes…" 
            className="bg-muted border-border pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="grid gap-2 text-sm grid-cols-3 w-full">
          <button
            onClick={() => setSidebarTab("palettes")}
            className={`rounded-lg px-2 py-2 flex items-center justify-center gap-1.5 transition-colors min-w-0 flex-1 ${
              sidebarTab === "palettes" 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted/50 border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <PaletteIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate text-xs">Palettes</span>
          </button>
          <button
            onClick={() => setSidebarTab("colors")}
            className={`rounded-lg px-2 py-2 flex items-center justify-center gap-1.5 transition-colors min-w-0 flex-1 ${
              sidebarTab === "colors" 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted/50 border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <Droplets className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate text-xs">Colors</span>
          </button>
          <button
            onClick={() => setSidebarTab("assets")}
            className={`rounded-lg px-2 py-2 flex items-center justify-center gap-1.5 transition-colors min-w-0 flex-1 ${
              sidebarTab === "assets" 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted/50 border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <Image className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate text-xs">Assets</span>
          </button>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3 min-h-0">
          {sidebarTab === "palettes" && (
            <>
              <div className="space-y-2 mb-4">
                <p className="text-xs font-medium text-muted-foreground">Filter by tags</p>
                <div className="flex flex-wrap gap-1">
                  {PREDEFINED_TAGS.map(tag => (
                    <Badge
                      key={tag}
                      variant={selectedTagsFilter.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => {
                        setSelectedTagsFilter(prev =>
                          prev.includes(tag) 
                            ? prev.filter(t => t !== tag)
                            : [...prev, tag]
                        );
                      }}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                {selectedTagsFilter.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTagsFilter([])}
                    className="h-7 text-xs"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear filters
                  </Button>
                )}
              </div>
              {filteredPalettes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No palettes found.</p>
              ) : (
                filteredPalettes.map((palette) => (
                  <button
                    key={palette.id}
                    onClick={() => applyPalette(palette)}
                    className="w-full text-left rounded-lg bg-muted/50 border border-border p-3 hover:bg-muted transition-colors"
                  >
                    <div className="flex h-6 rounded overflow-hidden mb-2">
                      {palette.colors.map((color, i) => (
                        <div key={i} className="flex-1" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                    <p className="text-sm font-medium truncate">{palette.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {palette.tags.slice(0, 3).join(", ")}
                    </p>
                  </button>
                ))
              )}
            </>
          )}
          {sidebarTab === "colors" && (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Color Picker</p>
              <Input 
                type="color" 
                value={selectedSlot?.color || "#000000"}
                onChange={(e) => {
                  if (selected !== null) {
                    setColorAt(selected, e.target.value.toUpperCase());
                  }
                }}
                className="w-full h-24 p-1 cursor-pointer"
              />
              <p className="text-xs">Select a color slot, then pick a color above.</p>
            </div>
          )}
          {sidebarTab === "assets" && (
            userId ? (
              <AssetsPanel 
                userId={userId} 
                userPlan={userPlan} 
                onPaletteGenerated={(colors, name) => {
                  setColorSlots(colors.map(c => ({ color: c, locked: false })));
                  toast.success(`Applied palette "${name}" from asset analysis`, { 
                    position: TOAST_POSITION 
                  });
                }}
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                Sign in to manage assets.
              </div>
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const chatContent = (
    <div className="h-full flex flex-col min-h-0">
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
      <Tabs
        value={chatMode}
        onValueChange={(v) => setChatMode(v as ChatMode)}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="grid grid-cols-2 m-4">
          <TabsTrigger value="ask">Ask mode</TabsTrigger>
          <TabsTrigger value="edit">Edit mode</TabsTrigger>
        </TabsList>
        <TabsContent value="ask" className="px-4 pb-4 flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 min-h-0 mb-4">
            <div className="space-y-3">
              {chatMessages.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground space-y-2">
                  <p>Ask me anything about Colored In or color theory!</p>
                  <p className="text-xs">Examples: "What features are in the Pro plan?", "How do I harmonize colors?", "What makes a good color palette?"</p>
                  {chatLimit > 0 && (
                    <p className="text-xs font-medium text-foreground pt-2">
                      {chatUsed} / {chatLimit} messages used this month
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {chatMessages.map((msg, i) => (
                    <div 
                      key={i} 
                      className={`rounded-xl p-3 text-sm ${
                        msg.role === "user" 
                          ? "bg-primary text-primary-foreground ml-8" 
                          : "bg-muted text-foreground mr-8"
                      }`}
                    >
                      {msg.content}
                    </div>
                  ))}
                  {isLoadingChat && (
                    <div className="rounded-xl p-3 text-sm bg-muted text-foreground mr-8 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Thinking...
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
          {chatLimit > 0 && chatMessages.length > 0 && (
            <p className="text-xs text-muted-foreground mb-2 text-center">
              {chatUsed} / {chatLimit} messages used
            </p>
          )}
          <div className="flex gap-2">
            <Input 
              placeholder="Ask a question..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isLoadingChat) {
                  e.preventDefault();
                  handleAskSubmit();
                }
              }}
              disabled={isLoadingChat}
            />
            <Button size="icon" onClick={handleAskSubmit} disabled={isLoadingChat || !chatInput.trim()}>
              {isLoadingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="edit" className="px-4 pb-4 space-y-3 flex-1 overflow-auto">
          <p className="text-sm text-muted-foreground">
            Quick edits apply to the {editScope === "selected" ? "selected color" : "whole palette"}.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => applyAdjustment("warmer")}
            >
              Warmer
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => applyAdjustment("cooler")}
            >
              Cooler
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => applyAdjustment("pastel")}
            >
              Pastel
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => applyAdjustment("contrast")}
            >
              More contrast
            </Button>
          </div>
          <Separator />
          <div className="space-y-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Scope</p>
            <div className="flex gap-2">
              <Button
                variant={editScope === "selected" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setEditScope("selected")}
              >
                Selected color
              </Button>
              <Button
                variant={editScope === "all" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setEditScope("all")}
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
    <>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPrimaryColorModal(true)}
          >
            <Droplets className="w-4 h-4 mr-2" />
            Primary Color
          </Button>
          <Button variant="ghost" size="sm" onClick={onOldDesign}>
            Old builder
          </Button>
          <Button variant="outline" size="sm" onClick={onBrowse}>
            Browse palettes
          </Button>
        </div>
      </header>

      {isDesktop ? (
        <PanelGroup direction="horizontal" className="flex-1 overflow-hidden">
          <Panel
            defaultSize={22}
            minSize={16}
            maxSize={35}
            className="border-r border-border bg-card"
          >
            {sidebarContent}
          </Panel>
          <PanelResizeHandle className="w-2 bg-border/30 hover:bg-border cursor-col-resize" />
          <Panel defaultSize={53} minSize={35} className="relative flex flex-col overflow-hidden">
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
              <div className="flex-1 flex flex-col">
                {/* Sticky color bar (always visible) */}
                <div className="sticky top-0 z-10 flex h-20 gap-0 overflow-hidden shadow-md bg-background border-b border-border">
                  {colorSlots.map((slot, idx) => {
                    const isSelected = idx === selected;
                    const textColor = contrastColor(slot.color);
                    return (
                      <button
                        type="button"
                        key={idx}
                        className={`relative flex-1 min-w-[120px] h-20 transition-all duration-200 cursor-pointer focus:outline-none ${
                          isSelected ? "ring-4 ring-primary ring-inset" : ""
                        }`}
                        style={{ backgroundColor: slot.color }}
                        onClick={() => handlePaletteClick(idx)}
                        title={slot.color}
                      >
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ color: textColor }}
                        >
                          <span className="text-xs sm:text-sm font-semibold font-mono px-2 py-1 rounded-full bg-black/20 backdrop-blur-sm">
                            {slot.color}
                          </span>
                        </div>
                        {slot.locked && (
                          <div
                            className="absolute top-2 right-2 rounded-full p-1.5 bg-black/30 backdrop-blur-sm"
                            style={{ color: textColor }}
                          >
                            <Lock className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Main palette canvas (fills remaining space) */}
                <div className="flex-1 flex overflow-hidden">
                  {colorSlots.map((slot, idx) => {
                    const isSelected = idx === selected;
                    const textColor = contrastColor(slot.color);
                    return (
                      <div
                        key={`canvas-${idx}`}
                        className={`relative flex-1 min-w-[160px] transition-all duration-200 cursor-pointer ${
                          isSelected ? "ring-4 ring-primary ring-inset" : ""
                        }`}
                        style={{ backgroundColor: slot.color }}
                        onClick={() => handlePaletteClick(idx)}
                      >
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
                          <div
                            className="text-2xl sm:text-3xl font-semibold font-mono px-4 py-2 rounded-full bg-black/20 backdrop-blur-sm"
                            style={{ color: textColor }}
                          >
                            {slot.color}
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="bg-black/25 text-white border-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(slot.color);
                              toast.success(`Copied ${slot.color}`, { position: TOAST_POSITION });
                            }}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy
                          </Button>
                        </div>

                        {slot.locked && (
                          <div
                            className="absolute top-4 right-4 rounded-full p-2 bg-black/30 backdrop-blur-sm"
                            style={{ color: textColor }}
                          >
                            <Lock className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <footer className="sticky bottom-0 z-10 border-t border-border bg-card/90 backdrop-blur px-4 py-3">
              <div className="flex items-center gap-2 overflow-x-auto flex-nowrap">
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
                  <Button size="sm" onClick={regenerate}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate (Space)
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={harmonizePalette}
                  >
                    <ArrowLeftRight className="w-4 h-4 mr-2" />
                    Harmonize
                  </Button>
                </div>
              </div>
            </footer>
          </div>
          </Panel>
          <PanelResizeHandle className="w-2 bg-border/30 hover:bg-border cursor-col-resize" />
          <Panel
            ref={chatPanelRef}
            defaultSize={25}
            minSize={18}
            maxSize={40}
            collapsible
            collapsedSize={0}
            className="border-l border-border bg-card/70 backdrop-blur"
          >
            {chatContent}
          </Panel>
        </PanelGroup>
      ) : (
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
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <div className="flex-1 flex">
                <div className="flex-1 flex flex-col">
                  {/* Sticky color bar (always visible) */}
                  <div className="sticky top-0 z-10 flex h-20 gap-0 overflow-hidden shadow-md bg-background border-b border-border">
                    {colorSlots.map((slot, idx) => {
                      const isSelected = idx === selected;
                      const textColor = contrastColor(slot.color);
                      return (
                        <button
                          type="button"
                          key={idx}
                          className={`relative flex-1 min-w-[120px] h-20 transition-all duration-200 cursor-pointer focus:outline-none ${
                            isSelected ? "ring-4 ring-primary ring-inset" : ""
                          }`}
                          style={{ backgroundColor: slot.color }}
                          onClick={() => handlePaletteClick(idx)}
                          title={slot.color}
                        >
                          <div
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ color: textColor }}
                          >
                            <span className="text-xs sm:text-sm font-semibold font-mono px-2 py-1 rounded-full bg-black/20 backdrop-blur-sm">
                              {slot.color}
                            </span>
                          </div>
                          {slot.locked && (
                            <div
                              className="absolute top-2 right-2 rounded-full p-1.5 bg-black/30 backdrop-blur-sm"
                              style={{ color: textColor }}
                            >
                              <Lock className="w-4 h-4" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Main palette canvas (fills remaining space) */}
                  <div className="flex-1 flex overflow-hidden">
                    {colorSlots.map((slot, idx) => {
                      const isSelected = idx === selected;
                      const textColor = contrastColor(slot.color);
                      return (
                        <div
                          key={`canvas-${idx}`}
                          className={`relative flex-1 min-w-[160px] transition-all duration-200 cursor-pointer ${
                            isSelected ? "ring-4 ring-primary ring-inset" : ""
                          }`}
                          style={{ backgroundColor: slot.color }}
                          onClick={() => handlePaletteClick(idx)}
                        >
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
                            <div
                              className="text-2xl sm:text-3xl font-semibold font-mono px-4 py-2 rounded-full bg-black/20 backdrop-blur-sm"
                              style={{ color: textColor }}
                            >
                              {slot.color}
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="bg-black/25 text-white border-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(slot.color);
                                toast.success(`Copied ${slot.color}`, { position: TOAST_POSITION });
                              }}
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              Copy
                            </Button>
                          </div>

                          {slot.locked && (
                            <div
                              className="absolute top-4 right-4 rounded-full p-2 bg-black/30 backdrop-blur-sm"
                              style={{ color: textColor }}
                            >
                              <Lock className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <footer className="sticky bottom-0 z-10 border-t border-border bg-card/90 backdrop-blur px-4 py-3">
                <div className="flex items-center gap-2 overflow-x-auto flex-nowrap">
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
                    <Button size="sm" onClick={regenerate}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Regenerate (Space)
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={harmonizePalette}
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
      )}
    </div>
    
    {/* Save Palette Modal */}
    <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Palette</DialogTitle>
          <DialogDescription>
            Give your palette a name and optionally add tags.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="palette-name">Palette Name</Label>
            <Input
              id="palette-name"
              value={savePaletteName}
              onChange={(e) => setSavePaletteName(e.target.value)}
              placeholder="My Beautiful Palette"
            />
          </div>
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {PREDEFINED_TAGS.map(tag => (
                <Badge
                  key={tag}
                  variant={savePaletteTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    setSavePaletteTags(prev =>
                      prev.includes(tag)
                        ? prev.filter(t => t !== tag)
                        : [...prev, tag]
                    );
                  }}
                >
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add custom tag..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customTag.trim()) {
                    setSavePaletteTags(prev => [...prev, customTag.trim()]);
                    setCustomTag("");
                  }
                }}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (customTag.trim()) {
                    setSavePaletteTags(prev => [...prev, customTag.trim()]);
                    setCustomTag("");
                  }
                }}
                disabled={!customTag.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {savePaletteTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {savePaletteTags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                    <X
                      className="w-3 h-3 ml-1 cursor-pointer"
                      onClick={() =>
                        setSavePaletteTags(prev => prev.filter(t => t !== tag))
                      }
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowSaveModal(false)}>
            Cancel
          </Button>
          <Button onClick={savePaletteWithName}>
            <Save className="w-4 h-4 mr-2" />
            Save Palette
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Primary Color Modal */}
    <Dialog open={showPrimaryColorModal} onOpenChange={setShowPrimaryColorModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Primary Color</DialogTitle>
          <DialogDescription>
            Choose a base color that will be used as the foundation for your palette.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="primary-color">Primary Color</Label>
            <Input
              id="primary-color"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
              className="w-full h-32 p-2 cursor-pointer"
            />
            <p className="text-sm text-muted-foreground text-center">{primaryColor}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowPrimaryColorModal(false)}>
            Cancel
          </Button>
          <Button onClick={() => {
            // Apply primary color to generate palette based on it
            const hsl = hexToHsl(primaryColor);
            const newColors = [];
            for (let i = 0; i < 5; i++) {
              const offset = (i - 2) * 30;
              const newHue = (hsl.h + offset + 360) % 360;
              const newColor = hslToHex({ h: newHue, s: hsl.s, l: hsl.l });
              newColors.push({ color: newColor, locked: i === 2 });
            }
            setColorSlots(newColors);
            setSelected(2);
            setShowPrimaryColorModal(false);
            toast.success("Palette generated from primary color", { position: TOAST_POSITION });
          }}>
            Generate Palette
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
