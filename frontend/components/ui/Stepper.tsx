import React from "react";
import { CheckIcon, PhotoIcon, TextIcon, DownloadIcon } from "./Icons";

export interface StepItem {
  id: string;
  label: string;
  type?: "image" | "text" | "export";
  completed?: boolean;
}

export interface StepperProps {
  steps: StepItem[];
  currentIndex: number;
  onSelectStep?: (index: number) => void;
}

export function Stepper({ steps, currentIndex, onSelectStep }: StepperProps) {
  return (
    <div className="stepper-container" role="tablist" aria-label="Poster creation steps">
      {steps.map((step, idx) => {
        const isCurrent = idx === currentIndex;
        const isCompleted = idx < currentIndex || step.completed;

        const getIcon = () => {
          if (isCompleted && !isCurrent) {
            return <CheckIcon size={14} />;
          }
          if (step.type === "image") return <PhotoIcon size={14} />;
          if (step.type === "text") return <TextIcon size={14} />;
          if (step.type === "export") return <DownloadIcon size={14} />;
          return idx + 1;
        };

        return (
          <button
            key={step.id || idx}
            type="button"
            className={`step-item ${isCurrent ? "active" : ""} ${isCompleted ? "completed" : ""}`}
            onClick={() => onSelectStep && onSelectStep(idx)}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span className="step-badge">{getIcon()}</span>
            <span>{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}
