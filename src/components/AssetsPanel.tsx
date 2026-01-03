import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPlanLimits } from "@/lib/planLimits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, Link as LinkIcon, Trash2, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Asset {
  id: string;
  type: "image" | "link";
  url: string;
  filename: string | null;
  created_at: string;
}

interface AssetsPanelProps {
  userId: string;
  userPlan: string;
}

export function AssetsPanel({ userId, userPlan }: AssetsPanelProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const planLimits = getPlanLimits(userPlan);
  const imageAssets = assets.filter(a => a.type === "image");
  const linkAssets = assets.filter(a => a.type === "link");

  useEffect(() => {
    fetchAssets();
  }, [userId]);

  const fetchAssets = async () => {
    const { data, error } = await supabase
      .from("user_assets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAssets(data as Asset[]);
    }
    setLoading(false);
  };

  const handleUploadImage = async (file: File) => {
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

    const { data: { publicUrl } } = supabase.storage
      .from("user-assets")
      .getPublicUrl(filePath);

    const { error: dbError } = await supabase.from("user_assets").insert({
      user_id: userId,
      type: "image",
      url: publicUrl,
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
    
    if (linkAssets.length >= planLimits.maxLinks) {
      toast.error(`Your plan allows max ${planLimits.maxLinks} link(s)`);
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
      const path = assetUrl.split("/").slice(-2).join("/");
      await supabase.storage.from("user-assets").remove([path]);
    }

    const { error } = await supabase
      .from("user_assets")
      .delete()
      .eq("id", assetId);

    if (!error) {
      toast.success("Asset deleted");
      fetchAssets();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="font-semibold mb-2">Upload Images</h3>
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
          className="w-full"
        >
          <Upload className="w-4 h-4 mr-2" />
          {isUploading ? "Uploading..." : "Upload Image"}
        </Button>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Add Links</h3>
        <p className="text-xs text-muted-foreground mb-3">
          {linkAssets.length} / {planLimits.maxLinks === Infinity ? "∞" : planLimits.maxLinks} links
        </p>
        <div className="flex gap-2">
          <Input
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="https://example.com"
            disabled={linkAssets.length >= planLimits.maxLinks}
          />
          <Button
            onClick={handleAddLink}
            disabled={linkAssets.length >= planLimits.maxLinks}
          >
            <LinkIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center gap-3 p-3 bg-muted rounded-lg"
            >
              {asset.type === "image" && (
                <img src={asset.url} alt={asset.filename || ""} className="w-12 h-12 object-cover rounded" />
              )}
              {asset.type === "link" && (
                <LinkIcon className="w-6 h-6 text-muted-foreground" />
              )}
              <div className="flex-1 text-sm truncate">
                <p className="font-medium">{asset.filename || asset.url}</p>
                <p className="text-xs text-muted-foreground">{asset.type}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(asset.id, asset.url, asset.type)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {assets.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No assets yet. Upload images or add links above.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

