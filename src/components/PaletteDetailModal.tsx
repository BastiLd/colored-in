import { useState } from "react";
import { Copy, X, Code, ChevronDown, Download, Image as ImageIcon, FileCode } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PaletteDetailModalProps {
  palette: {
    name: string;
    colors: string[];
    description?: string | null;
    colorDescriptions?: string[] | null;
  };
  onClose: () => void;
}

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

function generateCSS(colors: string[]): string {
  const lines = [":root {"];
  colors.forEach((color, i) => { lines.push(`  --color-${i + 1}: ${color};`); });
  lines.push("}");
  return lines.join("\n");
}

function generateSCSS(colors: string[]): string {
  return colors.map((color, i) => `$color-${i + 1}: ${color};`).join("\n");
}

function generateTailwind(colors: string[]): string {
  const config: Record<string, string> = {};
  colors.forEach((color, i) => { config[`palette-${i + 1}`] = color; });
  return `// tailwind.config.js\nmodule.exports = ${JSON.stringify({ theme: { extend: { colors: config } } }, null, 2)}`;
}

function generateArray(colors: string[]): string {
  return `const colors = ${JSON.stringify(colors, null, 2)};`;
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAsPNG(colors: string[], name: string) {
  const canvas = document.createElement("canvas");
  const colorWidth = 120;
  const height = 200;
  canvas.width = colors.length * colorWidth;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  colors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * colorWidth, 0, colorWidth, height);
    ctx.fillStyle = getContrastColor(color);
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(color, i * colorWidth + colorWidth / 2, height - 16);
  });

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
  toast.success("Exported as PNG!", { duration: 1500 });
}

function exportAsSVG(colors: string[], name: string) {
  const w = 120;
  const h = 200;
  const totalW = colors.length * w;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${h}" viewBox="0 0 ${totalW} ${h}">`;
  colors.forEach((color, i) => {
    svg += `<rect x="${i * w}" y="0" width="${w}" height="${h}" fill="${color}" />`;
    svg += `<text x="${i * w + w / 2}" y="${h - 16}" fill="${getContrastColor(color)}" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle">${color}</text>`;
  });
  svg += "</svg>";
  downloadFile(svg, `${name.replace(/\s+/g, "-").toLowerCase()}.svg`, "image/svg+xml");
  toast.success("Exported as SVG!", { duration: 1500 });
}

export function PaletteDetailModal({ palette, onClose }: PaletteDetailModalProps) {
  const copyColor = (color: string) => {
    navigator.clipboard.writeText(color);
    toast.success(`Copied ${color}`, { duration: 1500 });
  };

  const copyAllColors = () => {
    navigator.clipboard.writeText(palette.colors.join(", "));
    toast.success("Copied all colors!", { duration: 1500 });
  };

  const copyAsFormat = (format: string) => {
    let output = "";
    switch (format) {
      case "css": output = generateCSS(palette.colors); break;
      case "scss": output = generateSCSS(palette.colors); break;
      case "tailwind": output = generateTailwind(palette.colors); break;
      case "array": output = generateArray(palette.colors); break;
      default: output = palette.colors.join(", ");
    }
    navigator.clipboard.writeText(output);
    toast.success(`Copied as ${format.toUpperCase()}!`, { duration: 1500 });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-card rounded-2xl shadow-2xl overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with actions */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-semibold">{palette.name}</h2>
          <div className="flex items-center gap-2">
            {/* Export as image dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-secondary transition-colors text-sm text-muted-foreground">
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border">
                <DropdownMenuItem onClick={() => exportAsPNG(palette.colors, palette.name)} className="cursor-pointer">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  <span className="font-medium">PNG</span>
                  <span className="text-xs text-muted-foreground ml-2">Image File</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAsSVG(palette.colors, palette.name)} className="cursor-pointer">
                  <FileCode className="w-4 h-4 mr-2" />
                  <span className="font-medium">SVG</span>
                  <span className="text-xs text-muted-foreground ml-2">Vector File</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Copy as code dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-secondary transition-colors text-sm text-muted-foreground">
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

            <button onClick={copyAllColors} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Copy all colors">
              <Copy className="w-5 h-5 text-muted-foreground" />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {palette.colors.map((color, index) => (
              <div
                key={`${color}-${index}`}
                className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/60"
              >
                <button
                  onClick={() => copyColor(color)}
                  className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0"
                  style={{ backgroundColor: color }}
                  title={`Copy ${color}`}
                >
                  <span
                    className="absolute inset-x-0 bottom-1 text-[10px] font-mono text-center"
                    style={{ color: getContrastColor(color) }}
                  >
                    {color}
                  </span>
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{color}</span>
                    <button
                      onClick={() => copyColor(color)}
                      className="p-1 rounded hover:bg-muted"
                      title="Copy color"
                    >
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {palette.colorDescriptions?.[index] || "Explanation will appear here for AI-generated palettes."}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {palette.description && (
            <div className="text-sm text-muted-foreground bg-muted/30 border border-border rounded-lg p-3">
              <span className="font-medium text-foreground">Description: </span>
              {palette.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

