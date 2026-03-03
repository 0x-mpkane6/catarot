import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./index.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const VOICE_MIME_FALLBACK = "audio/webm";

function App() {
  const [question, setQuestion] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedAudioFile, setUploadedAudioFile] = useState(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState("");
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState("");
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const uploadedAudioUrlRef = useRef("");
  const recordedAudioUrlRef = useRef("");
  const audioInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (uploadedAudioUrlRef.current) {
        URL.revokeObjectURL(uploadedAudioUrlRef.current);
      }
      if (recordedAudioUrlRef.current) {
        URL.revokeObjectURL(recordedAudioUrlRef.current);
      }
    };
  }, []);

  const spreadType = "three";
  const requiredImageCount = 3;

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files.slice(0, requiredImageCount));
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const setUploadedVoiceFile = (file) => {
    if (uploadedAudioUrlRef.current) {
      URL.revokeObjectURL(uploadedAudioUrlRef.current);
      uploadedAudioUrlRef.current = "";
    }

    if (!file) {
      setUploadedAudioFile(null);
      setUploadedAudioUrl("");
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    uploadedAudioUrlRef.current = nextUrl;
    setUploadedAudioFile(file);
    setUploadedAudioUrl(nextUrl);
  };

  const clearRecordedVoice = () => {
    if (recordedAudioUrlRef.current) {
      URL.revokeObjectURL(recordedAudioUrlRef.current);
      recordedAudioUrlRef.current = "";
    }
    setRecordedAudioBlob(null);
    setRecordedAudioUrl("");
  };

  const clearUploadedVoice = () => {
    setUploadedVoiceFile(null);
    if (audioInputRef.current) {
      audioInputRef.current.value = "";
    }
  };

  const stopMediaStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const handleAudioFileChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setUploadedVoiceFile(file);
  };

  const startVoiceRecording = async () => {
    if (recording) {
      return;
    }

    if (typeof window === "undefined" || !window.MediaRecorder) {
      alert("This browser does not support voice recording.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Microphone access is not available in this browser.");
      return;
    }

    clearRecordedVoice();
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || VOICE_MIME_FALLBACK;
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        stopMediaStream();
        setRecording(false);

        if (!chunks.length) {
          return;
        }

        const blob = new Blob(chunks, { type: mimeType });
        const nextUrl = URL.createObjectURL(blob);
        recordedAudioUrlRef.current = nextUrl;
        setRecordedAudioBlob(blob);
        setRecordedAudioUrl(nextUrl);
      };

      recorder.onerror = () => {
        stopMediaStream();
        setRecording(false);
        alert("Voice recording failed. Please try again or upload an audio file.");
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      stopMediaStream();
      setRecording(false);
      console.error(err);
      alert("Could not access microphone. Please allow permission or upload an audio file.");
    }
  };

  const stopVoiceRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setRecording(false);
      stopMediaStream();
      return;
    }
    recorder.stop();
    mediaRecorderRef.current = null;
  };

  const clearVoice = () => {
    if (recording) {
      return;
    }
    clearRecordedVoice();
    clearUploadedVoice();
  };

  const submitReading = async ({ randomDraw }) => {
    if (!question.trim()) {
      alert("Please enter your question.");
      return;
    }

    if (!randomDraw && selectedFiles.length !== requiredImageCount) {
      alert("Please upload exactly 3 tarot cards.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("question", question);
    formData.append("spread_type", spreadType);
    formData.append("random_draw", randomDraw ? "true" : "false");

    selectedFiles.forEach((file) => {
      formData.append("image", file);
    });

    if (recordedAudioBlob) {
      const mimeType = recordedAudioBlob.type || VOICE_MIME_FALLBACK;
      const extension = mimeType.includes("wav") ? "wav" : "webm";
      const recordedFile = new File([recordedAudioBlob], `recorded_voice.${extension}`, { type: mimeType });
      formData.append("audio", recordedFile);
    } else if (uploadedAudioFile) {
      formData.append("audio", uploadedAudioFile);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/ask_with_media`, {
        method: "POST",
        body: formData,
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        const detail = data?.detail;
        const errorText = typeof detail === "string" ? detail : `HTTP ${res.status}`;
        throw new Error(errorText);
      }

      setResult(data);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Backend error.";
      alert(`Backend error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    await submitReading({ randomDraw: false });
  };

  const handleRandomDraw = async () => {
    await submitReading({ randomDraw: true });
  };

  const activeVoicePreviewUrl = recordedAudioUrl || uploadedAudioUrl;
  const activeVoiceLabel = recordedAudioBlob
    ? "Voice preview: recorded audio (priority)"
    : uploadedAudioFile
      ? "Voice preview: uploaded audio file"
      : "";
  const hasVoiceInput = Boolean(recordedAudioBlob || uploadedAudioFile);

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
        <div className="fixed-spread">Three Cards (Past - Present - Future)</div>

        <label>UPLOAD TAROT IMAGE (3 CARDS)</label>

        <div className="upload-row">
          <label className="custom-file-button">
            Choose Tarot Card
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              hidden
            />
          </label>

          <div className="file-inline-list">
            {selectedFiles.map((file, index) => (
              <div key={index} className="file-inline-item">
                <span className="file-inline-name">
                  {`${["Past", "Present", "Future"][index] ?? `Card ${index + 1}`}: `}
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

        <label>VOICE INPUT (OPTIONAL)</label>
        <div className="voice-box">
          <div className="voice-actions">
            <button
              type="button"
              className={`secondary-btn ${recording ? "is-recording" : ""}`}
              onClick={startVoiceRecording}
              disabled={loading || recording}
            >
              {recording ? "Recording..." : "Start Voice"}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={stopVoiceRecording}
              disabled={loading || !recording}
            >
              Stop Voice
            </button>
            <label className="custom-file-button">
              Upload Audio
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                onChange={handleAudioFileChange}
                hidden
              />
            </label>
            <button
              type="button"
              className="secondary-btn danger-btn"
              onClick={clearVoice}
              disabled={loading || recording || !hasVoiceInput}
            >
              Clear Voice
            </button>
          </div>

          {activeVoicePreviewUrl && (
            <div className="voice-preview">
              <div className="voice-caption">{activeVoiceLabel}</div>
              <audio controls src={activeVoicePreviewUrl} />
            </div>
          )}
        </div>

        <div className="action-buttons">
          <button type="button" onClick={handleRun} disabled={loading}>
            {loading ? "Reading..." : "Reading"}
          </button>
          <button
            type="button"
            className="random-btn"
            onClick={handleRandomDraw}
            disabled={loading}
          >
            {loading ? "Reading..." : "Random Draw"}
          </button>
        </div>

      </div>

      {/* ===== RESULT ===== */}
      {result && (
        <div className="result-layout">

          <div className="card-panel card-box">
            <h2>DETECTED CARD</h2>

            <h4>TRANSCRIPT</h4>
            <p className="transcript-line">
              {result.transcript ? result.transcript : "No transcript detected."}
            </p>

            {result.cards?.map((card, idx) => (
              <div key={idx} style={{ marginBottom: "20px" }}>
                <h3>{card.name}</h3>
                <p>Orientation: {card.orientation}</p>
                <p>Confidence: {Number(card.confidence ?? 0).toFixed(2)}</p>
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
