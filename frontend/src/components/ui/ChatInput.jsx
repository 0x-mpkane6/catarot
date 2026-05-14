import { useState, useRef } from "react";
import styles from "./ChatInput.module.css";

import uploadIcon from "../../assets/images/chatpage/upload.png";
import micIcon from "../../assets/images/chatpage/voice-icon.png";
import resetIcon from "../../assets/images/chatpage/reset.png";

export default function ChatInput({ onSend, onReset }) {
  const [mode, setMode] = useState("Select mode");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const [files, setFiles] = useState([]);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioURL, setAudioURL] = useState(null);

  const [recording, setRecording] = useState(false);
  const mediaRef = useRef(null);

  const [error, setError] = useState("");

  const fileRef = useRef(null);

  const options = ["Tarot", "Horoscope", "Natal Chart"];

  // ===== IMAGE (upload từng cái) =====
  const handleUploadClick = () => {
    fileRef.current.click();
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);

    if (files.length + selected.length > 3) {
      setError("Chỉ được tối đa 3 ảnh");
      return;
    }

    setError("");
    setFiles((prev) => [...prev, ...selected]);
  };

  const removeImage = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ===== VOICE =====
  const startRecording = async () => {
    if (recording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioURL(URL.createObjectURL(blob));
      };

      mediaRecorder.start();
      mediaRef.current = mediaRecorder;
      setRecording(true);
    } catch {
      setError("Không dùng được microphone");
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  const deleteAudio = () => {
    setAudioBlob(null);
    setAudioURL(null);
  };

  // ===== RESET =====
  const handleReset = () => {
    setText("");
    setFiles([]);
    setAudioBlob(null);
    setAudioURL(null);
    setMode("Select mode");
    setError("");

    onReset && onReset(); // gọi lên ChatPage nếu muốn reset luôn chat
  };

  // ===== SEND =====
  const handleSubmit = () => {
    if (mode === "Select mode") {
      setError("Chọn mode trước");
      return;
    }

    if (!text.trim() && !audioBlob && files.length === 0) {
      setError("Nhập text / voice / ảnh");
      return;
    }

    if (files.length > 0 && files.length !== 3) {
      setError("Phải đủ 3 ảnh mới gửi");
      return;
    }

    setError("");

    onSend({
      text,
      mode,
      audio: audioBlob,
      images: files,
    });

    // reset sau khi gửi
    setText("");
    setFiles([]);
    setAudioBlob(null);
    setAudioURL(null);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputBox}>
        {/* ERROR */}
        {error && <div className={styles.error}>⚠ {error}</div>}

        {/* PREVIEW IMAGE */}
        {files.length > 0 && (
          <div className={styles.previewRow}>
            {files.map((file, i) => (
              <div key={i} className={styles.previewItem}>
                <img src={URL.createObjectURL(file)} />
                <button onClick={() => removeImage(i)}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* AUDIO */}
        {audioURL && (
          <div className={styles.audioBox}>
            <audio controls src={audioURL}></audio>
            <button onClick={deleteAudio}>✕</button>
          </div>
        )}

        {/* INPUT */}
        <input
          type="text"
          placeholder="Enter your question"
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className={styles.bottom}>
          {/* MODE */}
          <div className={styles.dropdown}>
            <button
              className={styles.modeBtn}
              onClick={() => setOpen(!open)}
            >
              {mode !== "Select mode" && (
                <span
                  className={styles.clearBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMode("Select mode");
                  }}
                >
                  ✕
                </span>
              )}
              {mode}
            </button>

            {open && (
              <div className={styles.menu}>
                {options.map((item) => (
                  <div
                    key={item}
                    className={styles.option}
                    onClick={() => {
                      setMode(item);
                      setOpen(false);
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ACTIONS */}
          <div className={styles.actions}>
            {/* upload */}
            <button className={styles.iconBtn} onClick={handleUploadClick}>
              <img src={uploadIcon} />
            </button>

            <input
              type="file"
              multiple
              accept="image/*"
              ref={fileRef}
              hidden
              onChange={handleFileChange}
            />

            {/* mic */}
            {!recording ? (
              <button className={styles.iconBtn} onClick={startRecording}>
                <img src={micIcon} />
              </button>
            ) : (
              <button className={styles.recordingBtn} onClick={stopRecording}>
                ● STOP
              </button>
            )}

            {/* reset */}
            <button className={styles.iconBtn} onClick={handleReset}>
              <img src={resetIcon} alt="reset" />
            </button>

            {/* send */}
            <button className={styles.sendBtn} onClick={handleSubmit}>
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}