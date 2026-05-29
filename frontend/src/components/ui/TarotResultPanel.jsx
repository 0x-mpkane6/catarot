import { useState } from "react";

import tarotImages from "../../assets/tarot/tarot_json/tarot-images.json";

export default function TarotResultPanel({
  cards = [],
}) {

  const [previewCard, setPreviewCard] =
    useState(null);

  const getCardHeight = () => {

    if (cards.length <= 1)
      return 340;

    if (cards.length <= 3)
      return 230;

    return 170;
  };

  const getImagePath = (cardName) => {

    const matchedCard =
      tarotImages.cards.find(
        (item) =>
          item.name === cardName
      );

    return matchedCard
      ? `/src/assets/tarot/tarot_json/cards/${matchedCard.img}`
      : "";
  };

  return (

    <>

      {/* side panel */}
      <div
        style={{
          position: "fixed",

          top: "50%",
          right: "48px",

          transform:
            "translateY(-50%)",

          display: "flex",

          flexDirection: "column",

          justifyContent:
            cards.length <= 1
              ? "center"
              : "space-evenly",

          alignItems: "center",

          height: "78vh",

          width: "160px",

          zIndex: 40,
        }}
      >

        {cards.map((card, index) => (

          <div
            key={index}

            style={{
              width: "100%",

              display: "flex",

              justifyContent:
                "center",

              animation:
                `floatingReveal ${
                  3 + index
                }s ease-in-out infinite`,
            }}
          >

            <img
              src={getImagePath(card.name)}

              alt={card.name}

              onClick={() =>
                setPreviewCard(card)
              }

              style={{

                cursor: "pointer",

                height:
                  `${getCardHeight()}px`,

                objectFit:
                  "contain",

                borderRadius:
                  "18px",

                transform:
                  card.orientation ===
                  "reversed"
                    ? "rotate(180deg)"
                    : "rotate(0deg)",

                transition:
                  "0.35s ease",

                boxShadow:
                  `
                  0 0 34px
                  rgba(192,132,252,0.22)
                `,
              }}
            />

          </div>

        ))}

      </div>

      {/* preview modal */}
      {previewCard && (

       <div
        style={{

            position: "fixed",

            top: 0,

            right: 0,

            width: "380px",

            height: "100vh",

            zIndex: 999,

            background:
            `
            linear-gradient(
                180deg,
                rgba(12,8,24,0.96),
                rgba(7,5,16,0.98)
            )
            `,

            borderLeft:
            "1px solid rgba(255,255,255,0.06)",

            backdropFilter:
            "blur(24px)",

            boxShadow:
            `
            -20px 0 60px
            rgba(192,132,252,0.14)
            `,

            transition:
            "0.55s cubic-bezier(.16,1,.3,1)",

            transform:
                previewCard
                    ? "translateX(0%)"
                    : "translateX(100%)",

            display: "flex",

            flexDirection: "column",

            alignItems: "center",

            padding:
            "42px 28px",

            boxSizing:
            "border-box",

            overflow: "hidden",
        }}
        >

{previewCard && (

  <>

    {/* close */}
    <button
      onClick={() =>
        setPreviewCard(null)
      }

      style={{

        position: "absolute",

        top: "18px",
        right: "18px",

        width: "38px",
        height: "38px",

        borderRadius: "50%",

        border: "none",

        cursor: "pointer",

        background:
          "rgba(255,255,255,0.05)",

        color: "#fff",

        fontSize: "1rem",

        transition:
          "0.25s ease",
      }}
    >
      ✕
    </button>

    {/* glow bg */}
    <div
      style={{

        position: "absolute",

        top: "15%",

        width: "240px",
        height: "240px",

        borderRadius: "50%",

        background:
          "rgba(192,132,252,0.18)",

        filter:
          "blur(90px)",

        zIndex: 0,
      }}
    />

    {/* image */}
    <img
      src={
        getImagePath(
          previewCard.name
        )
      }

      alt={previewCard.name}

      style={{

        width: "270px",

        marginTop: "70px",

        borderRadius: "18px",

        zIndex: 2,

        transform:
          previewCard.orientation ===
          "reversed"
            ? "rotate(180deg)"
            : "rotate(0deg)",

        boxShadow:
          `
          0 0 45px
          rgba(217,70,239,0.18)
        `,

        transition:
          "0.4s ease",
      }}
    />

    {/* name */}
    <div
      style={{

        marginTop: "36px",

        color: "#fff",

        fontSize: "1.7rem",

        fontWeight: 700,

        textAlign: "center",

        zIndex: 2,
      }}
    >
      {previewCard.name}
    </div>

    {/* orientation */}
    <div
      style={{

        marginTop: "10px",

        color: "#d8b4fe",

        textTransform:
          "uppercase",

        letterSpacing:
          "0.12em",

        fontSize:
          "0.95rem",

        zIndex: 2,
      }}
    >
      {
        previewCard.orientation
      }
    </div>

  </>

)}

        </div>

      )}

    </>

  );
}
