import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import useIsMobile from "../../hooks/useIsMobile";
import tarotBack from "../../assets/images/homepage/tarot-back-des-2.png";

const TOTAL_CARDS = 36;
const CARDS_PER_ROW = 12;

const cards = Array.from(
  { length: TOTAL_CARDS },
  (_, index) => ({
    id: `tarot-card-${index + 1}`,
    index,
  })
);

export default function TarotSpreadGrid({
  requiredCards = 3,
  disabled = false,
  onSelectCard,
  onConfirm,
}) {

  const isMobile = useIsMobile();

  const [
    selectedCardIds,
    setSelectedCardIds,
  ] = useState([]);

  const selectedCards = useMemo(
    () =>
      cards.filter((card) =>
        selectedCardIds.includes(card.id)
      ),
    [selectedCardIds]
  );

  const handleSelectCard = (card) => {

    if (disabled) return;

    setSelectedCardIds((current) => {

      const alreadySelected =
        current.includes(card.id);

      // unselect
      if (alreadySelected) {

        const next = current.filter(
          (id) => id !== card.id
        );

        onSelectCard?.(
          cards.filter((item) =>
            next.includes(item.id)
          )
        );

        return next;
      }

      // limit
      if (
        current.length >= requiredCards
      ) {

        toast.error(
          `Chỉ được chọn ${requiredCards} lá bài.`
        );

        return current;
      }

      const next = [
        ...current,
        card.id,
      ];

      onSelectCard?.(
        cards.filter((item) =>
          next.includes(item.id)
        )
      );

      return next;
    });
  };

  const handleConfirm = () => {

    if (disabled) return;

    if (
      selectedCardIds.length <
      requiredCards
    ) {

      toast.error(
        `Vui lòng chọn ${requiredCards} lá bài trước khi tiếp tục.`
      );

      return;
    }

    onConfirm?.(selectedCards);
  };

  return (
    <>
      {/* floating animation */}
      <style>
        {`
          @keyframes floatingCard {

            0% {
              transform:
                translateY(0px);
            }

            50% {
              transform:
                translateY(-10px);
            }

            100% {
              transform:
                translateY(0px);
            }
          }
        `}
      </style>

      <section
        style={{
          width: "100%",

          minHeight: "100vh",

          display: "flex",

          flexDirection: "column",

          alignItems: "center",

          justifyContent: "center",

          padding:
            isMobile ? "86px 10px 96px" : "120px 40px 90px",

          boxSizing: "border-box",

          // KHÔNG đặt overflow:hidden ở đây — nếu đặt, <section> thành scroll-container của
          // nút Xác nhận (position:sticky) nhưng lại không tự cuộn → nút mất tầm dính, trôi
          // khỏi màn hình. Để overflow mặc định (visible) thì nút dính theo overlay cuộn được.

          background: `
            radial-gradient(
              circle at center,
              rgba(168,85,247,0.08),
              transparent 70%
            )
          `,
        }}
      >

        {/* title */}
        <div
          style={{
            textAlign: "center",

            marginBottom: "42px",
          }}
        >

          <div
            style={{
              fontSize: "2.2rem",

              fontWeight: 700,

              color: "#f5e9ff",

              letterSpacing: "0.03em",

              marginBottom: "10px",

              textShadow:
                "0 0 24px rgba(192,132,252,0.18)",
            }}
          >
            Rút bài của bạn
          </div>

          <div
            style={{
              color:
                "rgba(255,255,255,0.72)",

              fontSize: "1rem",
            }}
          >
            Đã chọn
            {" "}
            {selectedCardIds.length}
            /
            {requiredCards}
          </div>

        </div>

        {/* cards grid */}
        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              isMobile
                ? "repeat(4, 1fr)"
                : `repeat(${CARDS_PER_ROW}, 108px)`,

            gap: isMobile ? "8px" : "14px",

            justifyContent: "center",

            width: "100%",

            maxWidth: isMobile ? "100%" : "1220px",

            marginBottom: "52px",
          }}
        >

          {cards.map((card, index) => {

            const isSelected =
              selectedCardIds.includes(
                card.id
              );

            // thứ tự chọn (1,2,3) + có lá nào đang được chọn (để làm mờ các lá còn lại)
            const selectionOrder =
              selectedCardIds.indexOf(card.id) + 1;
            const anySelected =
              selectedCardIds.length > 0;

            return (

              <button
                key={card.id}

                type="button"

                disabled={disabled}

                onClick={() =>
                  handleSelectCard(card)
                }

                style={{
                  position: "relative",

                  // Mobile: lá co theo cột (width 100%) + giữ tỉ lệ 108:182.
                  width: isMobile ? "100%" : "108px",

                  height: isMobile ? "auto" : "182px",

                  ...(isMobile
                    ? { aspectRatio: "108 / 182" }
                    : null),

                  padding: 0,

                  border: "none",

                  background:
                    "transparent",

                  cursor:
                    disabled
                      ? "not-allowed"
                      : "pointer",

                  zIndex: isSelected ? 3 : 1,

                  opacity:
                    anySelected && !isSelected
                      ? 0.45
                      : 1,

                  transform: isSelected
                    ? isMobile
                      ? "translateY(-14px) scale(1.12)"
                      : "translateY(-26px) scale(1.12)"
                    : anySelected
                      ? "translateY(0px) scale(0.92)"
                      : "translateY(0px) scale(1)",

                  transition:
                    "all 240ms ease",

                animation: `
                tarotCardEnter 0.7s ease forwards,
                floatingCard ${
                    3 + (index % 4)
                }s ease-in-out infinite
                `,

                animationDelay:
                `
                    ${index * 45}ms,
                    ${0.7 + index * 0.045}s
                `,

                  filter: isSelected
                    ? "drop-shadow(0 0 22px rgba(217,70,239,0.95)) drop-shadow(0 0 52px rgba(168,85,247,0.6))"
                    : anySelected
                      ? "drop-shadow(0 10px 20px rgba(0,0,0,0.42)) brightness(0.58) saturate(0.85)"
                      : "drop-shadow(0 12px 24px rgba(0,0,0,0.42))",
                }}

                onMouseEnter={(e) => {

                  if (
                    isSelected ||
                    disabled
                  ) return;

                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.transform =
                    "translateY(-10px) scale(1.04)";
                  e.currentTarget.style.filter =
                    "drop-shadow(0 0 30px rgba(192,132,252,0.65))";
                }}

                onMouseLeave={(e) => {

                  if (
                    isSelected ||
                    disabled
                  ) return;

                  e.currentTarget.style.opacity =
                    anySelected ? "0.45" : "1";
                  e.currentTarget.style.transform =
                    anySelected
                      ? "translateY(0px) scale(0.92)"
                      : "translateY(0px) scale(1)";
                  e.currentTarget.style.filter =
                    anySelected
                      ? "drop-shadow(0 10px 20px rgba(0,0,0,0.42)) brightness(0.58) saturate(0.85)"
                      : "drop-shadow(0 12px 24px rgba(0,0,0,0.42))";
                }}
              >

                {/* huy hiệu số thứ tự lá đã chọn (1/2/3) — nổi bật, dễ nhận biết */}
                {isSelected && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-14px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 6,
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.95rem",
                      fontWeight: 800,
                      color: "#fff",
                      background:
                        "linear-gradient(135deg, #d946ef, #8b5cf6)",
                      border: "2px solid rgba(255,255,255,0.92)",
                      boxShadow:
                        "0 0 18px rgba(217,70,239,0.95), 0 4px 10px rgba(0,0,0,0.45)",
                    }}
                  >
                    {selectionOrder}
                  </span>
                )}

                {/* card */}
                <div
                  style={{
                    position: "relative",

                    width: "100%",

                    height: "100%",

                    overflow: "hidden",

                    borderRadius: "16px",

                    border: isSelected
                      ? "2px solid rgba(245,208,254,0.95)"
                      : "1px solid rgba(255,255,255,0.14)",

                    background:
                      "#12091d",

                    boxShadow: isSelected
                      ? "0 0 30px rgba(217,70,239,0.55), inset 0 0 26px rgba(217,70,239,0.22)"
                      : "0 18px 38px rgba(0,0,0,0.45)",
                  }}
                >

                  <img
                    src={tarotBack}

                    alt=""

                    draggable="false"

                    style={{
                      width: "100%",

                      height: "100%",

                      objectFit: "cover",

                      display: "block",

                      userSelect: "none",
                    }}
                  />

                  {/* glossy overlay */}
                  <div
                    style={{
                      position: "absolute",

                      inset: 0,

                      background:
                        isSelected
                          ? `
                            linear-gradient(
                              to bottom,
                              rgba(255,255,255,0.18),
                              transparent 45%,
                              rgba(217,70,239,0.24)
                            )
                          `
                          : `
                            linear-gradient(
                              to bottom right,
                              rgba(255,255,255,0.05),
                              transparent 55%,
                              rgba(0,0,0,0.18)
                            )
                          `,
                    }}
                  />

                </div>

              </button>
            );
          })}

        </div>

        {/* confirm button */}
        <button
          type="button"

          disabled={disabled}

          onClick={handleConfirm}

          style={{
            minWidth: "240px",

            height: "58px",

            padding: "0 30px",

            borderRadius: "999px",

            // Nút Xác nhận DÍNH ĐÁY (sticky) để LUÔN thấy khi cuộn lưới bài — cả desktop lẫn
            // mobile (trước chỉ mobile; desktop nút trôi xuống dưới đáy nên hay bị khuất).
            position: "sticky",
            bottom: isMobile ? "10px" : "24px",
            zIndex: 5,
            ...(isMobile ? { width: "100%", maxWidth: "360px" } : null),

            border:
              "1px solid rgba(255,255,255,0.14)",

            background:
              `
              linear-gradient(
                135deg,
                #8b5cf6,
                #d946ef,
                #f472b6
              )
            `,

            color: "#fff",

            fontSize: "1.05rem",

            fontWeight: 600,

            letterSpacing: "0.02em",

            cursor:
              disabled
                ? "not-allowed"
                : "pointer",

            opacity:
              disabled ? 0.6 : 1,

            boxShadow:
              `
              0 0 42px
              rgba(217,70,239,0.34)
            `,

            transition:
              "all 220ms ease",
          }}

          onMouseEnter={(e) => {

            if (disabled) return;

            e.currentTarget.style.transform =
              "translateY(-4px) scale(1.02)";
          }}

          onMouseLeave={(e) => {

            e.currentTarget.style.transform =
              "translateY(0px) scale(1)";
          }}
        >
          Xác nhận
          {" "}
          {selectedCardIds.length}
          /
          {requiredCards}
        </button>

      </section>
    </>
  );
}