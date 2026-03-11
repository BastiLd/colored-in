import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PaletteGenerator } from "@/components/PaletteGenerator";
import { parseColorsParam } from "@/lib/paletteUrl";

const Builder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialColors = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return parseColorsParam(params.get("colors"));
  }, [location.search]);

  return (
    <PaletteGenerator
      onBrowse={() => navigate("/explore")}
      onHome={() => navigate("/")}
      initialColors={initialColors}
    />
  );
};

export default Builder;
