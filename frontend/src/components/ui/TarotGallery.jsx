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
    },
    {
      image: timeCapsule,
      text: "Time Capsule",
    },
    {
      image: tarotReading,
      text: "Tarot Reading",
    },
    {
      image: duoReading,
      text: "Duo Reading",
    },
    {
      image: communityRoom,
      text: "Community Room",
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