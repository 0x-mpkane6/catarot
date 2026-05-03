import TarotCard from "./TarotCard";

const placeholders = [
  { position: "past" },
  { position: "present" },
  { position: "future" },
];

export default function CardSpread({ cards = [], revealed = false, loading = false }) {
  const displayCards = cards.length ? cards : placeholders;

  return (
    <section className={`card-spread ${loading ? "is-drawing" : ""}`} aria-label="Trải bài ba lá">
      {displayCards.slice(0, 3).map((card, index) => (
        <TarotCard
          key={`${card?.name || card.position || "hidden"}-${index}`}
          card={card}
          index={index}
          revealed={revealed}
          interactive={Boolean(cards.length)}
        />
      ))}
    </section>
  );
}
