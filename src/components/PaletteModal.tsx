import { useState } from "react";
import { X, Copy, Code, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Palette } from "@/data/palettes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PaletteModalProps {
  palette: Palette;
  onClose: () => void;
}

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function generateCSS(colors: string[]): string {
  const lines = [":root {"];
  colors.forEach((color, i) => {
    const varName = `--color-${i + 1}`;
    lines.push(`  ${varName}: ${color};`);
  });
  lines.push("}");
  return lines.join("\n");
}

function generateSCSS(colors: string[]): string {
  const lines: string[] = [];
  colors.forEach((color, i) => {
    lines.push(`$color-${i + 1}: ${color};`);
  });
  return lines.join("\n");
}

function generateTailwind(colors: string[]): string {
  const config = {
    theme: {
      extend: {
        colors: {} as Record<string, string>
      }
    }
  };
  colors.forEach((color, i) => {
    config.theme.extend.colors[`palette-${i + 1}`] = color;
  });
  return `// tailwind.config.js\nmodule.exports = ${JSON.stringify(config, null, 2)}`;
}

function generateArray(colors: string[]): string {
  return `const colors = ${JSON.stringify(colors, null, 2)};`;
}

export function PaletteModal({ palette, onClose }: PaletteModalProps) {
  const [hoveredColor, setHoveredColor] = useState<number | null>(null);

  const copyColor = (color: string) => {
    navigator.clipboard.writeText(color);
    toast.success(`Copied ${color}`, { duration: 1500, position: "bottom-center" });
  };

  const copyAllColors = () => {
    const colors = palette.colors.join(", ");
    navigator.clipboard.writeText(colors);
    toast.success("Copied all colors!", { duration: 1500, position: "bottom-center" });
  };

  const copyAsFormat = (format: string) => {
    let output = "";
    switch (format) {
      case "css":
        output = generateCSS(palette.colors);
        break;
      case "scss":
        output = generateSCSS(palette.colors);
        break;
      case "tailwind":
        output = generateTailwind(palette.colors);
        break;
      case "array":
        output = generateArray(palette.colors);
        break;
      default:
        output = palette.colors.join(", ");
    }
    navigator.clipboard.writeText(output);
    toast.success(`Copied as ${format.toUpperCase()}!`, { duration: 1500, position: "bottom-center" });
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-card rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Color bars */}
        <div className="flex h-40">
          {palette.colors.map((color, i) => (
            <div
              key={i}
              className="transition-all duration-200 flex items-center justify-center cursor-pointer"
              style={{ 
                backgroundColor: color,
                flex: hoveredColor === i ? 1.8 : 1
              }}
              onMouseEnter={() => setHoveredColor(i)}
              onMouseLeave={() => setHoveredColor(null)}
              onClick={() => copyColor(color)}
            >
              {hoveredColor === i && (
                <span 
                  className="text-sm font-mono font-medium px-2 py-1 rounded bg-black/20 backdrop-blur-sm"
                  style={{ color: getContrastColor(color) }}
                >
                  {color}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Header with title and actions */}
        <div className="p-4 flex items-center justify-between border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">{palette.name}</h2>
          <div className="flex items-center gap-2">
            {/* Copy as dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-secondary transition-colors text-sm text-muted-foreground"
                >
                  <Code className="w-4 h-4" />
                  <span>Copy as...</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border">
                <DropdownMenuItem onClick={() => copyAsFormat("css")} className="cursor-pointer">
                  <span className="font-medium">CSS</span>
                  <span className="text-xs text-muted-foreground ml-2">CSS Variables</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => copyAsFormat("scss")} className="cursor-pointer">
                  <span className="font-medium">SCSS</span>
                  <span className="text-xs text-muted-foreground ml-2">SASS Variables</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => copyAsFormat("tailwind")} className="cursor-pointer">
                  <span className="font-medium">Tailwind</span>
                  <span className="text-xs text-muted-foreground ml-2">Config Extension</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => copyAsFormat("array")} className="cursor-pointer">
                  <span className="font-medium">Array</span>
                  <span className="text-xs text-muted-foreground ml-2">JavaScript Array</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={copyAllColors}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
              title="Copy all colors"
            >
              <Copy className="w-5 h-5 text-muted-foreground" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Color list */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
          {palette.colors.map((color, i) => {
            const rgb = hexToRgb(color);
            return (
              <div 
                key={i}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
                onClick={() => copyColor(color)}
              >
                <div 
                  className="w-10 h-10 rounded-lg shadow-sm flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-mono text-sm text-foreground">{color}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    rgb({rgb.r}, {rgb.g}, {rgb.b})
                  </span>
                  {palette.colorDescriptions?.[i] && (
                    <span className="text-xs text-muted-foreground mt-1">
                      {palette.colorDescriptions[i]}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {palette.description && (
          <div className="px-4 pb-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Description: </span>
            {palette.description}
          </div>
        )}
      </div>
    </div>
  );
}
