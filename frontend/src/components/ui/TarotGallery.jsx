import CircularGallery from "./CircularGallery";

import theChariot from "../../assets/images/homepage/the-chariot.png";
import theEmperor from "../../assets/images/homepage/the-emperor.png";
import theHierophant from "../../assets/images/homepage/the-hierophant.png";
import theMoon from "../../assets/images/homepage/the-moon.png";
import justice from "../../assets/images/homepage/justice.png";

export default function TarotGallery() {
  const tarotCards = [
    {
      image: theChariot,
      text: "The Chariot",
    },
    {
      image: theEmperor,
      text: "The Emperor",
    },
    {
      image: theHierophant,
      text: "The Hierophant",
    },
    {
      image: theMoon,
      text: "The Moon",
    },
    {
      image: justice,
      text: "Justice",
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
        items={tarotCards}
        bend={1}
        textColor="#ffffff"
        borderRadius={0.05}
        scrollSpeed={2}
        scrollEase={0.05}

        scrollSpeed={1.2}
        scrollEase={0.03}   
      />
    </div>
  );
}