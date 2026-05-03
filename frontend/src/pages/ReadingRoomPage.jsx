import { useEffect } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import CardSpread from "../components/tarot/CardSpread";
import QuestionInput from "../components/tarot/QuestionInput";
import ReadingResult from "../components/tarot/ReadingResult";
import ReadingStepper from "../components/tarot/ReadingStepper";
import { useOracleStore } from "../stores/oracleStore";
import { useReadingStore } from "../stores/readingStore";

export default function ReadingRoomPage() {
  const setOracleState = useOracleStore((state) => state.setOracleState);
  const submitReading = useReadingStore((state) => state.submitReading);
  const result = useReadingStore((state) => state.result);
  const cards = useReadingStore((state) => state.cards);
  const loading = useReadingStore((state) => state.loading);
  const activeStep = useReadingStore((state) => state.activeStep);
  const error = useReadingStore((state) => state.error);

  useEffect(() => {
    setOracleState("idle");
  }, [setOracleState]);

  return (
    <div className="reading-room">
      <div className="page-kicker"><Sparkles size={16} /> Reading Room</div>
      <div className="room-grid">
        <QuestionInput loading={loading} onSubmit={submitReading} />
        <section className="spread-panel">
          <div className="section-heading compact">
            <Sparkles size={18} />
            <div>
              <p>Bàn trải bài</p>
              <h2>{loading ? "Các lá bài đang di chuyển" : "Ba vị trí đã sẵn sàng"}</h2>
            </div>
          </div>
          <CardSpread cards={cards} revealed={Boolean(result)} loading={loading} />
          {(loading || result) && <ReadingStepper activeStep={activeStep} loading={loading} />}
          {error && (
            <div className="warning-box">
              <AlertTriangle size={17} />
              <p>{error}</p>
            </div>
          )}
        </section>
      </div>
      <ReadingResult result={result} />
    </div>
  );
}
