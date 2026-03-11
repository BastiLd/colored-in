import { useNavigate } from "react-router-dom";
import { PaletteBrowser } from "@/components/PaletteBrowser";
import { buildBuilderSearch } from "@/lib/paletteUrl";

const Explore = () => {
  const navigate = useNavigate();

  const handleSelectPalette = (colors: string[]) => {
    navigate(`/builder${buildBuilderSearch(colors)}`);
  };

  return (
    <PaletteBrowser
      onBack={() => navigate("/dashboard")}
      onSelectPalette={handleSelectPalette}
    />
  );
};

export default Explore;
