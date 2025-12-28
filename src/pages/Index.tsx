import { useState, useCallback } from "react";
import { Toaster } from "@/components/ui/sonner";
import { HomePage } from "@/components/HomePage";
import { PaletteGenerator } from "@/components/PaletteGenerator";
import { PaletteBrowser } from "@/components/PaletteBrowser";

type View = "home" | "generator" | "browser";

const Index = () => {
  const [view, setView] = useState<View>("home");

  const handleSelectPalette = useCallback(() => {
    setView("generator");
  }, []);

  return (
    <>
      {view === "home" && (
        <HomePage 
          onStartGenerator={() => setView("generator")}
          onBrowsePalettes={() => setView("browser")}
        />
      )}
      {view === "generator" && (
        <PaletteGenerator onBrowse={() => setView("browser")} onHome={() => setView("home")} />
      )}
      {view === "browser" && (
        <PaletteBrowser 
          onBack={() => setView("home")} 
          onSelectPalette={handleSelectPalette}
        />
      )}
      <Toaster />
    </>
  );
};

export default Index;
