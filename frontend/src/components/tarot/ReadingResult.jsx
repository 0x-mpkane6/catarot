import ReactMarkdown from "react-markdown";
import { AlertTriangle, BookOpenText, MessageCircle } from "lucide-react";

export default function ReadingResult({ result }) {
  if (!result) {
    return (
      <section className="reading-result empty-result">
        <MessageCircle size={22} />
        <h2>Thông điệp chưa được lật mở</h2>
        <p>Hãy đặt câu hỏi, gửi ảnh hoặc để Oracle rút bài cho ngươi.</p>
      </section>
    );
  }

  return (
    <section className="reading-result">
      <div className="section-heading compact">
        <BookOpenText size={18} />
        <div>
          <p>Lời giải</p>
          <h2>Điều các lá bài muốn ngươi nhìn thấy</h2>
        </div>
      </div>
      {result.transcript && (
        <div className="transcript-box">
          <strong>Giọng nói được nghe thấy</strong>
          <p>{result.transcript}</p>
        </div>
      )}
      <div className="markdown-reading">
        <ReactMarkdown>{result.final_answer || "Màn sương chưa để lại thông điệp rõ ràng."}</ReactMarkdown>
      </div>
      {Array.isArray(result.warnings) && result.warnings.length > 0 && (
        <div className="warning-box">
          <AlertTriangle size={17} />
          <div>
            <strong>Dấu hiệu cần lưu ý</strong>
            <ul>
              {result.warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
