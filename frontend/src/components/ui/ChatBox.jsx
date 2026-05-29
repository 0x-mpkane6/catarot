import {
  Upload,
  ArrowBigUp,
  AudioLines,
  X,
  Mic,
  Square,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import toast from "react-hot-toast";

export default function ChatBox({
  mode = "reading",
  disabled = false,
  onSubmitDraft,
}) {
  const baseHeight = 28;
  const maxHeight = 180;

  const [question, setQuestion] =
    useState("");
  const [isMultiline, setIsMultiline] =
    useState(false);

  const [
    uploadedImages,
    setUploadedImages,
  ] = useState([]);

  const [isRecording, setIsRecording] =
    useState(false);

  const [audioBlob, setAudioBlob] =
    useState(null);

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const textareaRef = useRef(null);

  const supportsMedia = mode !== "daily";

  useEffect(() => {
    const textarea =
      textareaRef.current;

    if (!textarea) return;

    textarea.style.height =
      `${baseHeight}px`;

    const nextHeight =
      Math.min(
        Math.max(
          textarea.scrollHeight,
          baseHeight
        ),
        maxHeight
      );

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight
        ? "auto"
        : "hidden";

    setIsMultiline(
      textarea.scrollHeight >
        baseHeight + 4
    );
  }, [question, baseHeight, maxHeight]);

  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleImageUpload = (e) => {
    if (!supportsMedia) return;

    const files =
      Array.from(e.target.files);

    if (!files.length) return;

    setUploadedImages((prev) => {

      const merged = [
        ...prev,
        ...files,
      ];

      return merged.slice(0, 3);
    });

    e.target.value = "";
  };

  const removeImage = (index) => {

    setUploadedImages((prev) =>
      prev.filter((_, i) => i !== index)
    );
  };

  const handleVoiceToggle = async () => {
    if (!supportsMedia) return;

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      const recorder =
        new MediaRecorder(stream);

      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(
          audioChunksRef.current,
          {
            type:
              recorder.mimeType ||
              "audio/webm",
          }
        );

        const file = new File(
          [blob],
          "voice-recording.webm",
          {
            type: blob.type,
          }
        );

        setAudioBlob(file);
        setIsRecording(false);

        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setAudioBlob(null);
      setIsRecording(true);
    } catch (error) {
      console.error(error);
      toast.error(
        "Microphone permission denied"
      );
    }
  };

  const removeVoice = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    setAudioBlob(null);

    setIsRecording(false);
  };

  const handleSubmit = async () => {
    if (disabled) return;

    const trimmedQuestion =
      question.trim();

    if (
      !trimmedQuestion &&
      uploadedImages.length === 0 &&
      !audioBlob
    ) {

      toast.error(
        "Invalid input"
      );

      return;
    }

    await Promise.resolve(
      onSubmitDraft?.({
        mode,
        question: trimmedQuestion,
        images: uploadedImages,
        audio: audioBlob,
      })
    );

    setQuestion("");
    setUploadedImages([]);
    setAudioBlob(null);
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "900px",
      }}
    >

      {/* IMAGE PREVIEW */}
      {supportsMedia && uploadedImages.length > 0 && (

        <div
          style={{
            display: "flex",

            gap: "12px",

            marginBottom: "16px",

            flexWrap: "wrap",
          }}
        >

          {uploadedImages.map(
            (file, index) => (

            <div
              key={index}

              style={{
                position: "relative",
              }}
            >

              <img
                src={URL.createObjectURL(file)}

                alt="preview"

                style={{
                  width: "82px",
                  height: "82px",

                  objectFit: "cover",

                  borderRadius: "16px",

                  border:
                    "1px solid rgba(192,132,252,0.18)",

                  boxShadow:
                    "0 0 18px rgba(168,85,247,0.15)",
                }}
              />

              <button
                onClick={() =>
                  removeImage(index)
                }

                style={{
                  position: "absolute",

                  top: "-8px",
                  right: "-8px",

                  width: "24px",
                  height: "24px",

                  borderRadius: "50%",

                  border: "none",

                  background:
                    "#ef4444",

                  color: "#fff",

                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",

                  cursor: "pointer",
                }}
              >
                <X size={14} />
              </button>

            </div>
          ))}

        </div>
      )}

      {/* AUDIO PREVIEW */}
      {supportsMedia && (isRecording || audioBlob) && (

        <div
          style={{
            marginBottom: "14px",

            padding:
              "10px 14px",

            borderRadius: "16px",

            background:
              "rgba(239,68,68,0.08)",

            border:
              "1px solid rgba(239,68,68,0.2)",

            display: "flex",

            alignItems: "center",

            justifyContent:
              "space-between",
          }}
        >

          <div
            style={{
              display: "flex",

              alignItems: "center",

              gap: "10px",

              color: "#fca5a5",

              fontWeight: 600,
            }}
          >

            {isRecording ? (
              <>
                <Mic size={18} />
                Recording...
              </>
            ) : (
              <>
                <AudioLines size={18} />
                Voice attached
              </>
            )}

          </div>

          <button
            onClick={removeVoice}

            style={{
              background: "none",

              border: "none",

              color: "#fff",

              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>

        </div>
      )}

      {/* CHAT BOX */}
      <div
        style={{
          width: "100%",

          padding: "14px 18px",

          borderRadius: "28px",

          background:
            "rgba(18, 10, 35, 0.88)",

          border:
            "1px solid rgba(192, 132, 252, 0.14)",

          backdropFilter:
            "blur(20px)",

          boxShadow:
            "0 0 35px rgba(168, 85, 247, 0.08)",

          display: "flex",

          alignItems:
            isMultiline
              ? "flex-end"
              : "center",

          gap: "14px",

          boxSizing: "border-box",
        }}
      >

        {/* HIDDEN FILE INPUT */}
        <input
          ref={fileInputRef}

          type="file"

          accept="image/*"

          multiple

          hidden

          onChange={
            handleImageUpload
          }
        />

        {/* upload */}
        <button
          type="button"

          disabled={!supportsMedia || disabled}

          style={{
            ...iconButtonStyle,
            opacity:
              supportsMedia && !disabled ? 1 : 0.45,
            cursor:
              supportsMedia && !disabled
                ? "pointer"
                : "not-allowed",
          }}

          onClick={() =>
            fileInputRef.current?.click()
          }
        >
          <Upload size={22} />
        </button>

        {/* input */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={question}

          onChange={(e) =>
            setQuestion(
              e.target.value
            )
          }

          placeholder={
            mode === "daily"
              ? "How are you feeling today?"
              : "Ask the cards something..."
          }

          onKeyDown={async (e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey
            ) {
              e.preventDefault();
              await handleSubmit();
            }
          }}

          style={{
            flex: 1,

            background:
              "transparent",

            border: "none",

            outline: "none",

            color: "#ffffff",

            fontSize: "1rem",

            fontWeight: 500,

            fontFamily:
              "inherit",

            padding: "0 4px",
            minHeight: "28px",
            maxHeight: "180px",
            height: "28px",
            resize: "none",
            overflowY: "hidden",
            whiteSpace: "pre-wrap",
            lineHeight: "24px",
          }}
        />

        {/* voice */}
        <button
          type="button"

          disabled={!supportsMedia || disabled}

          style={{
            ...iconButtonStyle,

            background:
              isRecording
                ? "rgba(239,68,68,0.18)"
                : "rgba(255,255,255,0.04)",

            border:
              isRecording
                ? "1px solid rgba(239,68,68,0.35)"
                : "1px solid rgba(255,255,255,0.08)",

            color:
              isRecording
                ? "#fca5a5"
                : "#d8c8ff",

            opacity:
              supportsMedia && !disabled ? 1 : 0.45,

            cursor:
              supportsMedia && !disabled
                ? "pointer"
                : "not-allowed",
          }}

          onClick={
            handleVoiceToggle
          }
        >

          {isRecording ? (
            <Square size={18} />
          ) : (
            <AudioLines size={22} />
          )}

        </button>

        {/* send */}
        <button
          type="button"

          disabled={disabled}

          onClick={handleSubmit}

          style={{
            width: "46px",

            height: "46px",

            borderRadius: "50%",

            border: "none",

            background:
              "linear-gradient(135deg, #c084fc, #e879f9)",

            color: "#fff",

            display: "flex",

            alignItems: "center",

            justifyContent: "center",

            cursor:
              disabled
                ? "not-allowed"
                : "pointer",

            opacity:
              disabled ? 0.65 : 1,

            transition:
              "0.25s ease",

            boxShadow:
              "0 0 20px rgba(192,132,252,0.35)",
          }}
        >
          <ArrowBigUp size={24} />
        </button>

      </div>

    </div>
  );
}

const iconButtonStyle = {
  width: "42px",

  height: "42px",

  borderRadius: "50%",

  border:
    "1px solid rgba(255,255,255,0.08)",

  background:
    "rgba(255,255,255,0.04)",

  color: "#d8c8ff",

  display: "flex",

  alignItems: "center",

  justifyContent: "center",

  cursor: "pointer",

  transition: "0.25s ease",
};
