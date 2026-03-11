import { useNavigate } from "react-router-dom";
import { HomePage } from "@/components/HomePage";

const Index = () => {
  const navigate = useNavigate();

  return (
    <HomePage
      onStartGenerator={() => navigate("/builder")}
      onBrowsePalettes={() => navigate("/explore")}
    />
  );
};

export default Index;
