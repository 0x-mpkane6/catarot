import { useMemo, useState } from "react";
import toast from "react-hot-toast";

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
          `Please select only ${requiredCards} cards.`
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
        `Please select ${requiredCards} cards before continuing.`
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
            "120px 40px 90px",

          boxSizing: "border-box",

          overflow: "hidden",

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
            Draw Your Cards
          </div>

          <div
            style={{
              color:
                "rgba(255,255,255,0.72)",

              fontSize: "1rem",
            }}
          >
            Selected
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
              `repeat(${CARDS_PER_ROW}, 108px)`,

            gap: "14px",

            justifyContent: "center",

            width: "100%",

            maxWidth: "1220px",

            marginBottom: "52px",
          }}
        >

          {cards.map((card, index) => {

            const isSelected =
              selectedCardIds.includes(
                card.id
              );

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

                  width: "108px",

                  height: "182px",

                  padding: 0,

                  border: "none",

                  background:
                    "transparent",

                  cursor:
                    disabled
                      ? "not-allowed"
                      : "pointer",

                  transform: isSelected
                    ? `
                      translateY(-18px)
                      scale(1.05)
                    `
                    : `
                      translateY(0px)
                      scale(1)
                    `,

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
                    ? `
                      drop-shadow(
                        0 0 34px
                        rgba(217,70,239,0.58)
                      )
                    `
                    : `
                      drop-shadow(
                        0 12px 24px
                        rgba(0,0,0,0.42)
                      )
                    `,
                }}

                onMouseEnter={(e) => {

                  if (
                    isSelected ||
                    disabled
                  ) return;

                  e.currentTarget.style.transform =
                    `
                    translateY(-10px)
                    scale(1.03)
                  `;

                  e.currentTarget.style.filter =
                    `
                    drop-shadow(
                      0 0 28px
                      rgba(192,132,252,0.45)
                    )
                  `;
                }}

                onMouseLeave={(e) => {

                  if (
                    isSelected ||
                    disabled
                  ) return;

                  e.currentTarget.style.transform =
                    `
                    translateY(0px)
                    scale(1)
                  `;

                  e.currentTarget.style.filter =
                    `
                    drop-shadow(
                      0 12px 24px
                      rgba(0,0,0,0.42)
                    )
                  `;
                }}
              >

                {/* card */}
                <div
                  style={{
                    position: "relative",

                    width: "100%",

                    height: "100%",

                    overflow: "hidden",

                    borderRadius: "16px",

                    border: isSelected
                      ? `
                        1.5px solid
                        rgba(255,255,255,0.88)
                      `
                      : `
                        1px solid
                        rgba(255,255,255,0.14)
                      `,

                    background:
                      "#12091d",

                    boxShadow: isSelected
                      ? `
                        0 0 34px
                        rgba(217,70,239,0.28),

                        inset 0 0 24px
                        rgba(255,255,255,0.08)
                      `
                      : `
                        0 18px 38px
                        rgba(0,0,0,0.45)
                      `,
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
          Confirm
          {" "}
          {selectedCardIds.length}
          /
          {requiredCards}
        </button>

      </section>
    </>
  );
}