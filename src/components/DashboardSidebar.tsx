import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Home, Compass, Palette, Settings, LogOut, ChevronDown, BarChart3, CreditCard, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardSidebarProps {
  profile: {
    email: string | null;
    plan: string;
  } | null;
  currentView: string;
  onViewChange: (view: string) => void;
}

export const DashboardSidebar = ({ profile, currentView, onViewChange }: DashboardSidebarProps) => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col flex-shrink-0" data-tour="dashboard-sidebar">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <button
          onClick={() => navigate("/")}
          className="text-xl font-bold text-gradient font-display hover:opacity-80 transition-opacity"
        >
          Colored In
        </button>
      </div>

      {/* User Account */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
            {profile?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.email ?? "User"}</p>
            <p className="text-xs text-muted-foreground capitalize">{profile?.plan} Plan</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        <button
          onClick={() => onViewChange("home")}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            currentView === "home"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Home className="h-5 w-5" />
          <span>Home</span>
        </button>

        <button
          onClick={() => onViewChange("my-palettes")}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            currentView === "my-palettes"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Palette className="h-5 w-5" />
          <span>My Palettes</span>
        </button>

        <button
          onClick={() => onViewChange("uploads")}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            currentView === "uploads"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Upload className="h-5 w-5" />
          <span>My Uploads</span>
        </button>

        <button
          onClick={() => onViewChange("explore")}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            currentView === "explore"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Compass className="h-5 w-5" />
          <span>Explore</span>
        </button>

        <div className="mt-4 pt-4 border-t border-border">
          <button
            onClick={() => onViewChange("usage")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              currentView === "usage"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-5 w-5" />
            <span>Usage</span>
          </button>

          <button
            onClick={() => onViewChange("plan")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              currentView === "plan"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <CreditCard className="h-5 w-5" />
            <span>Plan</span>
          </button>
        </div>
      </nav>

      {/* Bottom Profile Section */}
      <div className="p-4 border-t border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-semibold text-sm">
                {profile?.email?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">{profile?.email ?? "User"}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings className="h-4 w-4 mr-2" />
              Safety Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
};
