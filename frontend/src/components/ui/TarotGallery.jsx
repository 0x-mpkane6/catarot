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
      text: "Tarot Hằng Ngày",
      mode: "daily"
    },
    {
      image: timeCapsule,
      text: "Kho Tầm Nhìn",
      mode: "visions"
    },
    {
      image: tarotReading,
      text: "Trải Bài",
      mode: "reading"
    },
    {
      image: duoReading,
      text: "Trải Bài Đôi",
      mode: "duo"

    },
    {
      image: communityRoom,
      text: "Phòng Cộng Đồng",
      mode: "community"
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
