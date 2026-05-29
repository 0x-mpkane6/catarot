import {
  useEffect,
  useMemo,
  useState,
} from "react";

import "./Shuffle.css";

const DEFAULT_CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const buildDisplayText = (
  target,
  progress,
  charset
) =>
  target
    .split("")
    .map((char, index) => {
      if (char === " ") {
        return " ";
      }

      if (index < progress) {
        return char;
      }

      return charset[
        Math.floor(
          Math.random() *
            charset.length
        )
      ];
    })
    .join("");

export default function Shuffle({
  text = "",
  className = "",
  style = {},
  tag = "div",
  textAlign = "center",
  duration = 1400,
  triggerOnHover = true,
}) {
  const [displayText, setDisplayText] =
    useState(text);
  const [isReady, setIsReady] =
    useState(false);

  const Tag = tag;

  const runShuffle = () => {
    const target = String(text);
    const steps = Math.max(
      target.replace(/\s/g, "")
        .length,
      1
    );
    let frame = 0;

    setIsReady(true);

    const interval =
      window.setInterval(() => {
        frame += 1;
        setDisplayText(
          buildDisplayText(
            target,
            frame,
            DEFAULT_CHARSET
          )
        );

        if (frame >= steps) {
          window.clearInterval(
            interval
          );
          setDisplayText(target);
        }
      }, duration / steps);

    return () =>
      window.clearInterval(
        interval
      );
  };

  useEffect(() => {
    const cleanup =
      runShuffle();

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rerun only when text/duration changes
  }, [text, duration]);

  const combinedClassName =
    useMemo(
      () =>
        `shuffle-parent ${
          isReady
            ? "is-ready"
            : ""
        } ${className}`.trim(),
      [className, isReady]
    );

  return (
    <Tag
      className={
        combinedClassName
      }
      style={{
        textAlign,
        ...style,
      }}
      onMouseEnter={() => {
        if (triggerOnHover) {
          runShuffle();
        }
      }}
    >
      {displayText}
    </Tag>
  );
}
