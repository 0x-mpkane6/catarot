import CircularGallery from "./CircularGallery";

import dailyTarot from "../../assets/images/homepage/the-princess.png";
import timeCapsule from "../../assets/images/homepage/the-emperor.png";
import tarotReading from "../../assets/images/homepage/the-magician.png";
import duoReading from "../../assets/images/homepage/the-lovers.png";
import communityRoom from "../../assets/images/homepage/the-world.png";

export default function TarotGallery({
  onCardClick,
}) {
  const tarotCards = [
    {
      image: dailyTarot,
      text: "Daily Tarot",
      mode: "daily"
    },
    {
      image: timeCapsule,
      text: "Time Capsule",
      mode: "coming-soon"
    },
    {
      image: tarotReading,
      text: "Tarot Reading",
      mode: "reading"
    },
    {
      image: duoReading,
      text: "Duo Reading",
      mode: "coming-soon"

    },
    {
      image: communityRoom,
      text: "Community Room",
      mode: "coming-soon"
    },
  ];

  return (
    <div
      style={{
        marginTop: "80px",
        width: "100%",
        height: "600px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <CircularGallery
        onCardClick={onCardClick}
        items={tarotCards}
        bend={1}
        textColor="#ffffff"
        borderRadius={0.05}

        scrollSpeed={1.2}
        scrollEase={0.03}   
      />
    </div>
  );
}