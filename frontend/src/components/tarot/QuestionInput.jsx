import { useEffect, useRef, useState } from "react";
import { ImagePlus, Mic, Send, Shuffle, Square, Trash2, Upload, WandSparkles } from "lucide-react";
import { useTypingOracle } from "../../hooks/useOracleReactions";
import { useOracleStore } from "../../stores/oracleStore";

const VOICE_MIME_FALLBACK = "audio/webm";

export default function QuestionInput({ loading = false, onSubmit }) {
  const [question, setQuestion] = useState("");
  useTypingOracle(question);
  const setOracleState = useOracleStore((state) => state.setOracleState);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedAudioFile, setUploadedAudioFile] = useState(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState("");
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState("");
  const [recording, setRecording] = useState(false);
  const [inputError, setInputError] = useState("");
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const uploadedUrlRef = useRef("");
  const recordedUrlRef = useRef("");
  const audioInputRef = useRef(null);

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (uploadedUrlRef.current) {
        URL.revokeObjectURL(uploadedUrlRef.current);
      }
      if (recordedUrlRef.current) {
        URL.revokeObjectURL(recordedUrlRef.current);
      }
    };
  }, []);

  const handleImages = (event) => {
    setSelectedFiles(Array.from(event.target.files || []).slice(0, 3));
  };

  const setUploadedVoice = (file) => {
    if (uploadedUrlRef.current) {
      URL.revokeObjectURL(uploadedUrlRef.current);
    }
    if (!file) {
      uploadedUrlRef.current = "";
      setUploadedAudioFile(null);
      setUploadedAudioUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    uploadedUrlRef.current = url;
    setUploadedAudioFile(file);
    setUploadedAudioUrl(url);
  };

  const clearRecordedVoice = () => {
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
    }
    recordedUrlRef.current = "";
    setRecordedAudioBlob(null);
    setRecordedAudioUrl("");
  };

  const stopMediaStream = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const startRecording = async () => {
    setInputError("");
    setOracleState("listening", "Ta đang ghé tai về phía ngươi - hãy nói...");
    if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
      setInputError("Trình duyệt này chưa hỗ trợ ghi âm trực tiếp.");
      return;
    }
    clearRecordedVoice();
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        stopMediaStream();
        setRecording(false);
        if (!chunks.length) {
          return;
        }
        const mimeType = recorder.mimeType || VOICE_MIME_FALLBACK;
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        recordedUrlRef.current = url;
        setRecordedAudioBlob(blob);
        setRecordedAudioUrl(url);
      };
      recorder.onerror = () => {
        stopMediaStream();
        setRecording(false);
        setInputError("Giọng nói của ngươi chưa đến được căn phòng. Hãy thử ghi âm lại rõ hơn.");
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      stopMediaStream();
      setRecording(false);
      setInputError("Không thể mở micro. Hãy cấp quyền hoặc tải file audio lên.");
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    setOracleState("thinking", "Ta đang nghiền ngẫm những gì ngươi vừa nói...");
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
    setUploadedVoice(null);
    if (audioInputRef.current) {
      audioInputRef.current.value = "";
    }
  };

  const getAudioFile = () => {
    if (recordedAudioBlob) {
      const mimeType = recordedAudioBlob.type || VOICE_MIME_FALLBACK;
      const extension = mimeType.includes("wav") ? "wav" : "webm";
      return new File([recordedAudioBlob], `oracle_voice.${extension}`, { type: mimeType });
    }
    return uploadedAudioFile;
  };

  const handleSubmit = (randomDraw) => {
    if (!question.trim()) {
      setInputError("Hãy nhập điều khiến lòng ngươi chưa yên.");
      return;
    }
    if (!randomDraw && selectedFiles.length > 0 && selectedFiles.length !== 3) {
      setInputError("Nếu dùng ảnh thật, hãy gửi đúng 3 lá cho trải quá khứ, hiện tại, tương lai.");
      return;
    }
    setInputError("");
    setOracleState("thinking", "Mụ đang nhìn vào quả cầu pha lê...");
    onSubmit({
      question,
      imageFiles: randomDraw ? [] : selectedFiles,
      audioFile: getAudioFile(),
      randomDraw,
    });
  };

  const activeAudioUrl = recordedAudioUrl || uploadedAudioUrl;

  return (
    <section className="question-panel">
      <div className="section-heading compact">
        <WandSparkles size={18} />
        <div>
          <p>Nghi thức đặt câu hỏi</p>
          <h2>Các lá bài đang lắng nghe</h2>
        </div>
      </div>

      <label className="input-label" htmlFor="question">Câu hỏi</label>
      <textarea
        id="question"
        rows={5}
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Hãy kể điều khiến lòng ngươi chưa yên..."
        maxLength={900}
      />
      <div className="input-meta">
        <span>{question.length}/900 ký tự</span>
        <span>Trải bài: Quá khứ - Hiện tại - Tương lai</span>
      </div>

      <div className="ritual-tools">
        <label className="tool-button">
          <ImagePlus size={16} />
          <span>Ảnh lá bài</span>
          <input type="file" accept="image/*" multiple hidden onChange={handleImages} />
        </label>
        <button className={`tool-button ${recording ? "recording" : ""}`} type="button" onClick={recording ? stopRecording : startRecording} disabled={loading}>
          {recording ? <Square size={16} /> : <Mic size={16} />}
          <span>{recording ? "Dừng ghi" : "Ghi âm"}</span>
        </button>
        <label className="tool-button">
          <Upload size={16} />
          <span>Audio</span>
          <input ref={audioInputRef} type="file" accept="audio/*" hidden onChange={(event) => setUploadedVoice(event.target.files?.[0] || null)} />
        </label>
        <button className="tool-button" type="button" onClick={clearVoice} disabled={loading || (!activeAudioUrl && !uploadedAudioFile)}>
          <Trash2 size={16} />
          <span>Xóa giọng</span>
        </button>
      </div>

      {selectedFiles.length > 0 && (
        <div className="file-chips">
          {selectedFiles.map((file, index) => (
            <span key={`${file.name}-${index}`}>{["Quá khứ", "Hiện tại", "Tương lai"][index]}: {file.name}</span>
          ))}
        </div>
      )}

      {activeAudioUrl && (
        <div className="audio-preview">
          <audio controls src={activeAudioUrl} />
        </div>
      )}

      {inputError && <p className="mystic-error">{inputError}</p>}

      <div className="primary-actions">
        <button className="primary-button" type="button" onClick={() => handleSubmit(false)} disabled={loading}>
          <Send size={17} />
          <span>{loading ? "Đang mở màn sương..." : "Bắt đầu đọc bài"}</span>
        </button>
        <button className="secondary-magic-button" type="button" onClick={() => handleSubmit(true)} disabled={loading}>
          <Shuffle size={17} />
          <span>Rút ngẫu nhiên</span>
        </button>
      </div>
    </section>
  );
}
