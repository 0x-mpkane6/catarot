import { useState } from "react";
import ReactMarkdown from "react-markdown";
import "./index.css";

function App() {
  const [question, setQuestion] = useState("");
  const [spreadType, setSpreadType] = useState("single");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // ===== Handle File Change =====
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);

    if (spreadType === "single") {
      setSelectedFiles(files.slice(0, 1));
    } else {
      setSelectedFiles(files.slice(0, 3));
    }
  };

  // ===== Remove File =====
  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ===== Handle Submit =====
  const handleRun = async () => {
    if (!question.trim()) {
      alert("Please enter your question.");
      return;
    }

    if (spreadType === "single" && selectedFiles.length !== 1) {
      alert("Please upload exactly 1 tarot card.");
      return;
    }

    if (spreadType === "three" && selectedFiles.length !== 3) {
      alert("Please upload 3 tarot cards.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("question", question);
    formData.append("spread_type", spreadType);

    selectedFiles.forEach((file) => {
      formData.append("image", file);
    });

    try {
      const res = await fetch("http://127.0.0.1:8000/api/ask_with_image", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      alert("Backend error.");
    }

    setLoading(false);
  };

  return (
    <div className="app-container">
      <h1 className="title">Tarot Multimodal Reader</h1>
      <p className="subtitle">
        Explore guidance through vision, voice, and language.
      </p>

      {/* ===== FORM ===== */}
      <div className="card-box">

        <label>QUESTION</label>
        <textarea
          rows={3}
          placeholder="Enter your question here..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <label>SPREAD TYPE</label>
        <select
          value={spreadType}
          onChange={(e) => {
            setSpreadType(e.target.value);
            setSelectedFiles([]); // reset files
          }}
        >
          <option value="single">Single Card</option>
          <option value="three">Three Cards</option>
        </select>

        <label>UPLOAD TAROT IMAGE</label>

        <div className="upload-row">
          <label className="custom-file-button">
            Choose Tarot Card
            <input
              type="file"
              accept="image/*"
              multiple={spreadType === "three"}
              onChange={handleFileChange}
              hidden
            />
          </label>

          <div className="file-inline-list">
            {selectedFiles.map((file, index) => (
              <div key={index} className="file-inline-item">
                <span className="file-inline-name">
                  {spreadType === "three"
                    ? `${["Past", "Present", "Future"][index]}: `
                    : ""}
                  {file.name}
                </span>
                <span
                  className="file-inline-remove"
                  onClick={() => removeFile(index)}
                >
                  ×
                </span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleRun} disabled={loading}>
          {loading ? "Reading..." : "Reading"}
        </button>

      </div>

      {/* ===== RESULT ===== */}
      {result && (
        <div className="result-layout">

          <div className="card-panel card-box">
            <h2>DETECTED CARD</h2>

            {result.cards?.map((card, idx) => (
              <div key={idx} style={{ marginBottom: "20px" }}>
                <h3>{card.name}</h3>
                <p>Orientation: {card.orientation}</p>
                <p>Confidence: {card.confidence.toFixed(2)}</p>
              </div>
            ))}

            {result.warnings?.length > 0 && (
              <>
                <h4>WARNINGS</h4>
                <ul>
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="answer-panel card-box">
            <h2>INTERPRETATION</h2>
            <ReactMarkdown>
              {result.final_answer}
            </ReactMarkdown>
          </div>

        </div>
      )}
    </div>
  );
}

export default App;