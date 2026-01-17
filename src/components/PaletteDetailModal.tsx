import { Copy, X } from "lucide-react";
import { toast } from "sonner";

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

export function PaletteDetailModal({ palette, onClose }: PaletteDetailModalProps) {
  const copyColor = (color: string) => {
    navigator.clipboard.writeText(color);
    toast.success(`Copied ${color}`, { duration: 1500 });
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
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-semibold">{palette.name}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
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

