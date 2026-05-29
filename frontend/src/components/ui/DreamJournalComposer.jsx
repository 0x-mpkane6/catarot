import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AudioLines,
  Mic,
  Square,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

function AutoResizeTextarea({
  value,
  minHeight = 110,
  maxHeight = 220,
  style,
  ...props
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea =
      textareaRef.current;

    if (!textarea) return;

    textarea.style.height =
      `${minHeight}px`;

    const nextHeight =
      Math.min(
        Math.max(
          textarea.scrollHeight,
          minHeight
        ),
        maxHeight
      );

    textarea.style.height =
      `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight
        ? "auto"
        : "hidden";
  }, [value, minHeight, maxHeight]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      rows={1}
      value={value}
      className="visions-field__textarea"
      style={{
        ...style,
        minHeight: `${minHeight}px`,
        maxHeight: `${maxHeight}px`,
        height: `${minHeight}px`,
      }}
    />
  );
}

export default function DreamJournalComposer({
  onSubmit,
  isSubmitting = false,
}) {
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [rawText, setRawText] =
    useState("");
  const [audioFile, setAudioFile] =
    useState(null);
  const [isRecording, setIsRecording] =
    useState(false);

  const audioPreviewUrl =
    useMemo(
      () =>
        audioFile
          ? URL.createObjectURL(
              audioFile
            )
          : "",
      [audioFile]
    );

  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }

      if (audioPreviewUrl) {
        URL.revokeObjectURL(
          audioPreviewUrl
        );
      }
    };
  }, [audioPreviewUrl]);

  const clearAudio = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    setAudioFile(null);
    setIsRecording(false);
  };

  const handleVoiceToggle =
    async () => {
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
            "dream-voice-note.webm",
            {
              type: blob.type,
            }
          );

          setAudioFile(file);
          setIsRecording(false);

          stream
            .getTracks()
            .forEach((track) =>
              track.stop()
            );
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
        setAudioFile(null);
        setIsRecording(true);
      } catch (error) {
        console.error(error);
        toast.error(
          "Microphone permission denied"
        );
      }
    };

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      await onSubmit?.({
        raw_text:
          rawText.trim(),
        audio: audioFile,
      });

      setRawText("");
      clearAudio();
    };

  return (
    <div className="visions-card">
      <div className="visions-panel__eyebrow">
        Dream Journal
      </div>
      <div
        style={{
          marginTop: "8px",
          fontSize: "1.2rem",
          fontWeight: 800,
        }}
      >
        Translate subconscious symbols
      </div>
      <div className="visions-field__hint">
        Write the dream, or attach an audio note. The
        backend will extract symbols and cross-reference
        them with recent readings.
      </div>

      <form
        className="visions-form"
        onSubmit={handleSubmit}
        style={{ marginTop: "18px" }}
      >
        <div>
          <label className="visions-field__label">
            Dream Text
          </label>
          <AutoResizeTextarea
            value={rawText}
            onChange={(event) =>
              setRawText(
                event.target.value
              )
            }
            placeholder="I dreamt of stairs, rain, and a room full of mirrors..."
          />
        </div>

        <div>
          <label className="visions-field__label">
            Audio Note
          </label>

          <div className="visions-actions">
            <button
              type="button"
              className="visions-audio-trigger"
              onClick={handleVoiceToggle}
              style={{
                background:
                  isRecording
                    ? "rgba(239,68,68,0.18)"
                    : undefined,
                borderColor:
                  isRecording
                    ? "rgba(239,68,68,0.35)"
                    : undefined,
                color:
                  isRecording
                    ? "#fca5a5"
                    : undefined,
              }}
            >
              <span>
                {isRecording ? (
                  <Square size={16} />
                ) : (
                  <Mic size={16} />
                )}
              </span>
              <span>
                {isRecording
                  ? "Stop Recording"
                  : "Voice Note"}
              </span>
            </button>

            {(isRecording || audioFile) && (
              <div
                className="visions-audio-preview"
              >
                <div className="visions-audio-preview__meta">
                  <div className="visions-audio-preview__icon">
                    <AudioLines size={16} />
                  </div>
                  <div>
                    <div className="visions-audio-preview__title">
                      {isRecording
                        ? "Recording..."
                        : "Voice note ready"}
                    </div>
                    {!isRecording &&
                      audioFile && (
                        <div className="visions-audio-preview__filename">
                          {audioFile.name}
                        </div>
                      )}
                  </div>
                </div>

                {!isRecording &&
                  audioPreviewUrl && (
                  <audio
                    controls
                    src={audioPreviewUrl}
                    className="visions-audio-preview__player"
                  />
                )}

                <button
                  type="button"
                  onClick={clearAudio}
                  className="visions-audio-trigger visions-audio-trigger--ghost"
                  title={
                    isRecording
                      ? "Cancel recording"
                      : "Remove audio"
                  }
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {!audioFile && !isRecording && (
            <div className="visions-field__hint">
              Tap voice note to record right here, then
              listen back before saving.
            </div>
          )}
        </div>

        <div className="visions-actions">
          <button
            type="submit"
            className="visions-button visions-button--primary"
            disabled={
              isSubmitting ||
              (!rawText.trim() &&
                !audioFile)
            }
          >
            {isSubmitting
              ? "Saving..."
              : "Save Dream Entry"}
          </button>
        </div>
      </form>
    </div>
  );
}
