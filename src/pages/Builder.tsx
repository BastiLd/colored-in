import { useNavigate } from "react-router-dom";
import { PaletteGenerator } from "@/components/PaletteGenerator";

const Builder = () => {
  const navigate = useNavigate();

  return (
    <PaletteGenerator
      onBrowse={() => navigate("/explore")}
      onHome={() => navigate("/")}
    />
  );
};

export default Builder;
