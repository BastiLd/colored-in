import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface TourStep {
  id: string;
  title: string;
  description: string;
  selector: string;
  placement?: "top" | "right" | "bottom" | "left";
}

interface GuidedTourProps {
  steps: TourStep[];
  storageKey: string;
  enabled?: boolean;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function GuidedTour({ steps, storageKey, enabled = true }: GuidedTourProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [position, setPosition] = useState({ top: 80, left: 20 });
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const seen = localStorage.getItem(storageKey);
    if (!seen) {
      setIsOpen(true);
    }
  }, [enabled, storageKey]);

  useLayoutEffect(() => {
    if (!isOpen || steps.length === 0) return;
    const step = steps[currentIndex];
    const target = document.querySelector(step.selector) as HTMLElement | null;
    const tooltip = tooltipRef.current;

    if (!target) {
      setPosition({ top: 80, left: 20 });
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const rect = target.getBoundingClientRect();
    const tooltipWidth = tooltip?.offsetWidth ?? 300;
    const tooltipHeight = tooltip?.offsetHeight ?? 180;

    let top = rect.bottom + 12;
    let left = rect.left;

    switch (step.placement) {
      case "top":
        top = rect.top - tooltipHeight - 12;
        left = rect.left;
        break;
      case "right":
        top = rect.top;
        left = rect.right + 12;
        break;
      case "left":
        top = rect.top;
        left = rect.left - tooltipWidth - 12;
        break;
      default:
        top = rect.bottom + 12;
        left = rect.left;
        break;
    }

    top = clamp(top, 12, window.innerHeight - tooltipHeight - 12);
    left = clamp(left, 12, window.innerWidth - tooltipWidth - 12);
    setPosition({ top, left });

    target.classList.add("tour-highlight");
    return () => {
      target.classList.remove("tour-highlight");
    };
  }, [currentIndex, isOpen, steps]);

  const closeTour = () => {
    localStorage.setItem(storageKey, "done");
    setIsOpen(false);
  };

  const handleNext = () => {
    if (currentIndex >= steps.length - 1) {
      closeTour();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  if (!isOpen || steps.length === 0) return null;

  const step = steps[currentIndex];
  const isLastStep = currentIndex === steps.length - 1;

  return (
    <>
      <div className="tour-overlay" />
      <div
        ref={tooltipRef}
        className="tour-tooltip"
        style={{ top: position.top, left: position.left }}
      >
        <div className="tour-title">{step.title}</div>
        <div className="tour-description">{step.description}</div>
        <div className="tour-actions">
          <button className="tour-skip" onClick={closeTour}>
            Skip
          </button>
          <button className="tour-next" onClick={handleNext}>
            {isLastStep ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}

