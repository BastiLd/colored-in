import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStoragePathFromUrl, USER_ASSETS_BUCKET } from "@/lib/storage";
import { getPlanLimits } from "@/lib/planLimits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, Link as LinkIcon, Trash2, Loader2, Sparkles, Check, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Asset {
  id: string;
  type: "image" | "link";
  url: string;
  filename: string | null;
  created_at: string;
  displayUrl?: string | null;
}

interface AssetsPanelProps {
  userId: string;
  userPlan: string;
  onPaletteGenerated?: (colors: string[], name: string) => void;
}

export function AssetsPanel({ userId, userPlan, onPaletteGenerated }: AssetsPanelProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [analyzingAssetId, setAnalyzingAssetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const planLimits = getPlanLimits(userPlan);
  const isPaidPlan = userPlan !== "free" && (planLimits.maxImages > 0 || planLimits.maxLinks > 0);
  const imageAssets = assets.filter(a => a.type === "image");
  const linkAssets = assets.filter(a => a.type === "link");

  useEffect(() => {
    fetchAssets();
  }, [userId]);

  const resolveAssetUrls = async (items: Asset[]) => {
    const resolved = await Promise.all(
      items.map(async (asset) => {
        if (asset.type !== "image") return asset;
        if (asset.url.startsWith("data:") || asset.url.startsWith("blob:")) {
          return { ...asset, displayUrl: asset.url };
        }
        if (asset.url.includes("/storage/v1/object/sign/")) {
          return { ...asset, displayUrl: asset.url };
        }
        const path = getStoragePathFromUrl(asset.url);
        if (!path) {
          return { ...asset, displayUrl: asset.url };
        }
        const { data, error } = await supabase.storage
          .from(USER_ASSETS_BUCKET)
          .createSignedUrl(path, 60 * 60);
        if (!error && data?.signedUrl) {
          return { ...asset, displayUrl: data.signedUrl };
        }
        const { data: publicData } = supabase.storage
          .from(USER_ASSETS_BUCKET)
          .getPublicUrl(path);
        if (publicData?.publicUrl) {
          return { ...asset, displayUrl: publicData.publicUrl };
        }
        return { ...asset, displayUrl: asset.url };
      })
    );
    setAssets(resolved);
  };

  const fetchAssets = async () => {
    const { data, error } = await supabase
      .from("user_assets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      await resolveAssetUrls(data as Asset[]);
    }
    setLoading(false);
  };

  const handleUploadImage = async (file: File) => {
    if (!isPaidPlan) {
      toast.error("Image upload requires a paid plan");
      return;
    }
    
    if (imageAssets.length >= planLimits.maxImages) {
      toast.error(`Your plan allows max ${planLimits.maxImages} image(s)`);
      return;
    }

    setIsUploading(true);
    
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("user-assets")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Failed to upload image");
      setIsUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from("user_assets").insert({
      user_id: userId,
      type: "image",
      url: filePath,
      filename: file.name,
    });

    if (dbError) {
      toast.error("Failed to save asset");
    } else {
      toast.success("Image uploaded!");
      fetchAssets();
    }

    setIsUploading(false);
  };

  const handleAddLink = async () => {
    if (!linkInput.trim()) return;
    
    if (!isPaidPlan) {
      toast.error("Adding links requires a paid plan");
      return;
    }
    
    if (linkAssets.length >= planLimits.maxLinks) {
      toast.error(`Your plan allows max ${planLimits.maxLinks} link(s)`);
      return;
    }

    // Basic URL validation
    try {
      new URL(linkInput);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    const { error } = await supabase.from("user_assets").insert({
      user_id: userId,
      type: "link",
      url: linkInput,
      filename: null,
    });

    if (error) {
      toast.error("Failed to add link");
    } else {
      toast.success("Link added!");
      setLinkInput("");
      fetchAssets();
    }
  };

  const handleDelete = async (assetId: string, assetUrl: string, type: string) => {
    if (type === "image") {
      const path = getStoragePathFromUrl(assetUrl);
      if (path) {
        await supabase.storage.from(USER_ASSETS_BUCKET).remove([path]);
      }
    }

    const { error } = await supabase
      .from("user_assets")
      .delete()
      .eq("id", assetId);

    if (!error) {
      toast.success("Asset deleted");
      if (selectedAssetId === assetId) {
        setSelectedAssetId(null);
      }
      fetchAssets();
    }
  };

  const getAnalysisUrl = async (asset: Asset) => {
    if (asset.displayUrl && asset.displayUrl !== asset.url) {
      return asset.displayUrl;
    }
    if (asset.type !== "image") {
      return asset.url;
    }
    const path = getStoragePathFromUrl(asset.url);
    if (!path) {
      return asset.displayUrl || asset.url;
    }
    const { data, error } = await supabase.storage
      .from(USER_ASSETS_BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) {
      return asset.displayUrl || asset.url;
    }
    return data.signedUrl;
  };

  const handleAnalyze = async (asset: Asset) => {
    if (!isPaidPlan) {
      toast.error("Asset analysis requires a paid plan. Upgrade to Pro!");
      return;
    }

    setAnalyzingAssetId(asset.id);
    
    try {
      const analysisUrl = await getAnalysisUrl(asset);
        const { data, error } = await supabase.functions.invoke('analyze-asset', {
        body: {
          assetType: asset.type,
          assetUrl: analysisUrl,
        }
      });

      if (error) {
        console.error('Analyze error:', error);
        toast.error(error.message || "Failed to analyze asset");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.colors && Array.isArray(data.colors)) {
        toast.success(`Palette "${data.name}" generated!`);
        
        if (onPaletteGenerated) {
          onPaletteGenerated(data.colors, data.name);
        }
      } else {
        toast.error("Invalid response from analysis");
      }
    } catch (err) {
      console.error('Analyze error:', err);
      toast.error("Failed to analyze asset");
    } finally {
      setAnalyzingAssetId(null);
    }
  };

  const handleSelectAsset = (assetId: string) => {
    setSelectedAssetId(prev => prev === assetId ? null : assetId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!isPaidPlan) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-center py-8 px-4 bg-muted/50 rounded-lg border border-border">
          <Sparkles className="w-8 h-8 mx-auto mb-3 text-primary" />
          <h3 className="font-semibold mb-2">Pro Feature</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload images and add website links, then let AI analyze them to generate matching color palettes.
          </p>
          <Button size="sm" onClick={() => window.location.href = '/pricing'}>
            Upgrade to Pro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 min-w-0 overflow-hidden flex flex-col h-full">
      {/* Upload Images Section */}
      <div className="min-w-0 flex-shrink-0">
        <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
          <Upload className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Upload Images</span>
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          {imageAssets.length} / {planLimits.maxImages === Infinity ? "∞" : planLimits.maxImages} images
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleUploadImage(e.target.files[0]);
            }
          }}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || imageAssets.length >= planLimits.maxImages}
          className="w-full min-w-0"
          size="sm"
        >
          <Upload className="w-4 h-4 mr-2 flex-shrink-0" />
          <span className="truncate">{isUploading ? "Uploading..." : "Upload Image"}</span>
        </Button>
      </div>

      {/* Images Grid - Responsive layout */}
      {imageAssets.length > 0 && (
        <div className="min-w-0 flex-1 overflow-hidden flex flex-col">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex-shrink-0">Your Images</p>
          <ScrollArea className="flex-1 min-h-0">
            <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(96px,1fr))]">
            {imageAssets.map((asset) => {
              const isSelected = selectedAssetId === asset.id;
              const isAnalyzing = analyzingAssetId === asset.id;
              
              return (
                <div
                  key={asset.id}
                  className={`relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer aspect-square ${
                    isSelected 
                      ? "border-primary ring-2 ring-primary/30" 
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => handleSelectAsset(asset.id)}
                >
                  <img 
                    src={asset.displayUrl || asset.url} 
                    alt={asset.filename || ""} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="%23888" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                    }}
                  />
                  
                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                  
                  {/* Overlay with actions */}
                  <div className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1 transition-opacity ${
                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAnalyze(asset);
                      }}
                      disabled={isAnalyzing}
                      className="text-xs h-7 px-2"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(asset.id, asset.url, asset.type);
                      }}
                      className="text-xs h-7 px-2"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
            </div>
          </ScrollArea>
        </div>
      )}

      <Separator className="flex-shrink-0" />

      {/* Add Links Section */}
      <div className="min-w-0 flex-shrink-0">
        <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
          <LinkIcon className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Add Website Links</span>
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          {linkAssets.length} / {planLimits.maxLinks === Infinity ? "∞" : planLimits.maxLinks} links
        </p>
        <div className="flex flex-col gap-2">
          <Input
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="https://example.com"
            disabled={linkAssets.length >= planLimits.maxLinks}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddLink();
              }
            }}
            className="text-sm w-full min-w-0"
          />
          <Button
            onClick={handleAddLink}
            disabled={linkAssets.length >= planLimits.maxLinks || !linkInput.trim()}
            className="w-full min-w-0"
            size="sm"
          >
            <LinkIcon className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="truncate">Add Link</span>
          </Button>
        </div>
      </div>

      {/* Links List */}
      {linkAssets.length > 0 && (
        <div className="min-w-0 flex-1 overflow-hidden flex flex-col">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex-shrink-0">Your Links</p>
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-2">
            {linkAssets.map((asset) => {
              const isSelected = selectedAssetId === asset.id;
              const isAnalyzing = analyzingAssetId === asset.id;
              
              // Try to extract domain from URL
              let displayUrl = asset.url;
              try {
                const url = new URL(asset.url);
                displayUrl = url.hostname;
              } catch {
                // Keep original if parsing fails
              }
              
              return (
                <div
                  key={asset.id}
                  className={`flex flex-wrap items-center gap-2 p-2 rounded-lg border-2 transition-all cursor-pointer ${
                    isSelected 
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30" 
                      : "border-border bg-muted/50 hover:border-primary/50"
                  }`}
                  onClick={() => handleSelectAsset(asset.id)}
                >
                  {/* Selection indicator */}
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isSelected ? "bg-primary" : "bg-muted border border-border"
                  }`}>
                    {isSelected && <Check className="w-2 h-2 text-primary-foreground" />}
                  </div>
                  
                  <LinkIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-xs font-medium truncate break-all">{displayUrl}</p>
                  </div>
                  
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(asset.url, '_blank');
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAnalyze(asset);
                      }}
                      disabled={isAnalyzing}
                      className="h-8 text-xs"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 mr-1" />
                          Analyze
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(asset.id, asset.url, asset.type);
                      }}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Empty state */}
      {assets.length === 0 && (
        <div className="text-center py-8 px-4 bg-muted/30 rounded-lg border border-dashed border-border">
          <Sparkles className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No assets yet. Upload images or add links above, then click "Analyze" to generate palettes!
          </p>
        </div>
      )}
    </div>
  );
}
