import { useNavigate } from "react-router-dom";
import { PaletteBrowser } from "@/components/PaletteBrowser";

const Explore = () => {
  const navigate = useNavigate();

  const handleSelectPalette = () => {
    navigate("/dashboard?view=generator");
  };

  return (
    <PaletteBrowser
      onBack={() => navigate("/dashboard")}
      onSelectPalette={handleSelectPalette}
    />
  );
};

export default Explore;
