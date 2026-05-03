import { useMemo } from "react";
import { usePreferencesStore } from "../../stores/preferencesStore";

const RUNE_GLYPHS = ["☾", "✦", "✧", "✶", "♆", "♅", "☉", "☽", "✺", "❂", "✷", "❖"];

export default function MysticBackground() {
  const reduceMotion = usePreferencesStore((state) => state.reduceMotion);

  const particles = useMemo(
    () =>
      Array.from({ length: 56 }, (_, index) => ({
        id: index,
        left: `${(index * 17 + 7) % 100}%`,
        top: `${(index * 41 + 11) % 100}%`,
        delay: `${(index % 11) * 0.6}s`,
        duration: `${10 + (index % 7) * 1.4}s`,
        size: `${2 + (index % 5)}px`,
        hue: index % 4,
      })),
    [],
  );

  const shootingStars = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => ({
        id: index,
        top: `${8 + index * 13}%`,
        left: `${-10 + (index * 7) % 30}%`,
        delay: `${index * 4.6}s`,
        duration: `${5 + (index % 3) * 1.2}s`,
      })),
    [],
  );

  const runes = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => ({
        id: index,
        glyph: RUNE_GLYPHS[index % RUNE_GLYPHS.length],
        left: `${(index * 23 + 5) % 92}%`,
        top: `${(index * 37 + 9) % 88}%`,
        size: `${18 + (index % 4) * 6}px`,
        delay: `${(index % 6) * 1.3}s`,
        duration: `${22 + (index % 5) * 4}s`,
        spin: index % 2 === 0 ? "runeSpin" : "runeSpinReverse",
        opacity: 0.18 + (index % 3) * 0.07,
      })),
    [],
  );

  const orbs = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) => ({
        id: index,
        left: `${10 + index * 18}%`,
        top: `${15 + (index * 13) % 60}%`,
        size: `${160 + index * 40}px`,
        delay: `${index * 1.4}s`,
        duration: `${14 + index * 2}s`,
        hue: index % 3,
      })),
    [],
  );

  return (
    <div className={`mystic-background ${reduceMotion ? "reduce-motion" : ""}`} aria-hidden="true">
      {/* lớp aurora chuyển động phía sau cùng */}
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />
      <div className="aurora aurora-c" />

      {/* nebula glow blobs to */}
      {!reduceMotion && (
        <div className="nebula-field">
          {orbs.map((orb) => (
            <span
              key={orb.id}
              className={`nebula-orb hue-${orb.hue}`}
              style={{
                left: orb.left,
                top: orb.top,
                width: orb.size,
                height: orb.size,
                animationDelay: `${orb.delay}`,
                animationDuration: `${orb.duration}`,
              }}
            />
          ))}
        </div>
      )}

      <div className="moon-window" />
      <div className="moon-disc" />
      <div className="star-field" />
      <div className="star-field star-field-2" />
      <div className="constellation" />

      {/* sương nhiều lớp */}
      <div className="mist-layer mist-one" />
      <div className="mist-layer mist-two" />
      <div className="mist-layer mist-three" />

      <div className="magic-circle" />
      <div className="magic-circle magic-circle-small" />

      {/* sao băng */}
      {!reduceMotion && (
        <div className="shooting-stars" aria-hidden="true">
          {shootingStars.map((star) => (
            <span
              key={star.id}
              className="shooting-star"
              style={{
                top: star.top,
                left: star.left,
                animationDelay: star.delay,
                animationDuration: star.duration,
              }}
            />
          ))}
        </div>
      )}

      {/* particles bay */}
      {!reduceMotion && (
        <div className="particle-field">
          {particles.map((particle) => (
            <span
              key={particle.id}
              className={`particle particle-hue-${particle.hue}`}
              style={{
                left: particle.left,
                top: particle.top,
                width: particle.size,
                height: particle.size,
                animationDelay: particle.delay,
                animationDuration: particle.duration,
              }}
            />
          ))}
        </div>
      )}

      {/* runes Tarot xoay quanh */}
      {!reduceMotion && (
        <div className="rune-field" aria-hidden="true">
          {runes.map((rune) => (
            <span
              key={rune.id}
              className="rune-glyph"
              style={{
                left: rune.left,
                top: rune.top,
                fontSize: rune.size,
                opacity: rune.opacity,
                animation: `${rune.spin} ${rune.duration} linear infinite, runeFloat ${parseInt(rune.duration, 10) / 2}s ease-in-out infinite`,
                animationDelay: `${rune.delay}, ${rune.delay}`,
              }}
            >
              {rune.glyph}
            </span>
          ))}
        </div>
      )}

      {/* vignette mờ rìa */}
      <div className="vignette" />
    </div>
  );
}
