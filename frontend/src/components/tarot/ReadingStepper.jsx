import { Check, Loader2 } from "lucide-react";
import { readingSteps } from "../../stores/readingStore";

export default function ReadingStepper({ activeStep = 0, loading = false }) {
  return (
    <ol className="reading-stepper" aria-label="Tiến trình đọc bài">
      {readingSteps.map((step, index) => {
        const isDone = index < activeStep || (!loading && activeStep === readingSteps.length - 1);
        const isActive = index === activeStep && loading;
        return (
          <li key={step} className={`${isDone ? "done" : ""} ${isActive ? "active" : ""}`}>
            <span>{isDone ? <Check size={14} /> : isActive ? <Loader2 size={14} /> : index + 1}</span>
            <p>{step}</p>
          </li>
        );
      })}
    </ol>
  );
}
