from __future__ import annotations

from collections import Counter
import json
import os
import random
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from .data import TarotCard

POSITIONS = ("Past", "Present", "Future")
ORIENTATIONS = ("Upright", "Reversed")

POSITION_LENSES = {
    "Past": "la dau vet cua mot mau hanh vi cu van con tac dong den hien tai",
    "Present": "la diem nong can xu ly truc tiep trong giai doan nay",
    "Future": "la xu huong co kha nang mo ra o buoc tiep theo",
}

SUIT_THEMES = {
    "Cups": {
        "domain": "cam xuc, su gan ket va cach ban tiep nhan nguoi khac",
        "focus": "goi ten cam xuc that va giao tiep ro nhu cau",
    },
    "Swords": {
        "domain": "tu duy, su that va quyet dinh",
        "focus": "cat bo nhieu, uu tien du lieu va gioi han ro rang",
    },
    "Wands": {
        "domain": "dong luc, hanh dong va su sang tao",
        "focus": "chuyen hoa y tuong thanh buoc lam cu the",
    },
    "Pentacles": {
        "domain": "cong viec, tai chinh va nen tang vat chat",
        "focus": "toi uu he thong, ky luat va qua trinh ben vung",
    },
}

NUMBER_THEMES = {
    "Ace": ("khoi tao mot dong nang luong moi", "bat dau nho, do duoc, va giu nhip deu"),
    "Two": ("can bang giua hai lua chon", "chon mot uu tien chinh thay vi om ca hai"),
    "Three": ("hop tac va mo rong", "tim nguoi bo tro dung vai tro de tang toc"),
    "Four": ("on dinh va bao toan", "giu vung nen tang, tranh mo rong qua som"),
    "Five": ("xung dot hoac xao tron", "nhin thang vao van de va quy ve muc tieu cot loi"),
    "Six": ("dieu chinh de tien bo", "toi uu cach lam va di chuyen khoi diem tac"),
    "Seven": ("thu nghiem va danh gia", "kiem tra gia thuyet truoc khi cam ket lon"),
    "Eight": ("tap trung cao do", "cat bo phan tan va lam sau mot huong"),
    "Nine": ("gan den moc thanh qua", "giu ky luat, chot nhung viec dang do"),
    "Ten": ("hoan tat mot chu ky", "dong goi bai hoc va tai phan bo nguon luc"),
}

COURT_THEMES = {
    "Page": ("tin hieu hoc hoi moi", "giu tam the nguoi moi, hoc nhanh va cap nhat lien tuc"),
    "Knight": ("xung luc hanh dong manh", "day nhanh tien do nhung can diem dung de ra soat"),
    "Queen": ("su chin chan noi tai", "quan tri cam xuc va he thong bang su tinh te"),
    "King": ("nang luc lanh dao va ra quyet dinh", "dat tieu chuan, phan quyen va chiu trach nhiem cuoi"),
}

MAJOR_THEMES = {
    "The Fool": ("khoi dau moi va niem tin vao hanh trinh", "thu nghiem co tinh toan, dung so sai ngay tu dau"),
    "The Magician": ("chu dong tao ket qua bang ky nang va y chi", "tap trung nguon luc vao mot muc tieu then chot"),
    "The High Priestess": ("truc giac va tri thuc an", "giam toc de lang nghe du lieu noi tam"),
    "The Empress": ("nuoi duong, sinh truong va su phong phu", "dau tu vao nen tang dai han thay vi ket qua nhanh"),
    "The Emperor": ("ky luat, cau truc va quyen han", "thiet lap nguyen tac ro va giu ky cuong"),
    "The Hierophant": ("he gia tri, truyen thong va hoc tu he thong", "tim mentor hoac framework da duoc chung minh"),
    "The Lovers": ("lua chon theo gia tri cot loi", "dong bo tri oc, cam xuc va hanh dong"),
    "The Chariot": ("y chi tien len va kha nang dieu huong", "giu muc tieu ro, tranh lech huong boi phan tam"),
    "Strength": ("noi luc ben bi va tu chu", "dung su binh tinh de quan ly xung luc"),
    "The Hermit": ("tu van noi tam va thanh loc uu tien", "tam lui mot buoc de thay buc tranh lon"),
    "Wheel of Fortune": ("chu ky bien dong va co hoi bat ngo", "linh hoat voi thay doi, tranh bam chap"),
    "Justice": ("can bang, trach nhiem va he qua", "dua vao su that va nguyen tac cong bang"),
    "The Hanged Man": ("doi goc nhin va tam dung chien luoc", "chap nhan tre nhip de doi lay do ro"),
    "Death": ("ket thuc can thiet de tai sinh", "cat dut thu da het gia tri de mo cho moi"),
    "Temperance": ("dieu do, hoa hop va tich hop", "ket hop cac mat doi lap theo nhip vua phai"),
    "The Devil": ("rang buoc, le thuoc va mau vo thuc", "go ten dieu dang rang buoc ban va dat gioi han"),
    "The Tower": ("pha vo cau truc cu khong con phu hop", "chuan bi phuong an du phong va tai xay nen tang"),
    "The Star": ("hy vong, phuc hoi va tam nhin tich cuc", "giu niem tin co co so va tiep tuc ben bi"),
    "The Moon": ("mo ho, lo au va tin hieu ngam", "kiem chung thong tin truoc khi ket luan"),
    "The Sun": ("ro rang, suc song va ket qua tich cuc", "day manh hanh dong o huong dang co da"),
    "Judgement": ("thuc tinh va quyet dinh tai dinh huong", "tong ket bai hoc cu de ra lua chon moi"),
    "The World": ("hoan thanh, tich hop va chuyen chu ky", "chot thanh qua va nang cap muc tieu tiep"),
}

SYSTEM_PROMPT = """You are an experienced tarot reader.
Return valid JSON only with this exact shape:
{
  "card_meanings": [
    {
      "card": "string",
      "position": "Past|Present|Future",
      "orientation": "Upright|Reversed",
      "meaning": "2-4 clear sentences"
    }
  ],
  "combined_meaning": "One coherent synthesis in 4-8 sentences"
}
Rules:
- Keep content practical and non-fatalistic.
- No extra keys.
- card_meanings must contain exactly 3 items.
"""


@dataclass(frozen=True)
class DrawnCard:
    card: TarotCard
    position: str
    orientation: str

    def to_state(self) -> dict[str, Any]:
        return {
            "card": self.card.to_state(),
            "position": self.position,
            "orientation": self.orientation,
        }

    @classmethod
    def from_state(cls, payload: dict[str, Any]) -> "DrawnCard":
        return cls(
            card=TarotCard.from_state(payload["card"]),
            position=str(payload["position"]),
            orientation=str(payload["orientation"]),
        )


def draw_three_cards(cards: list[TarotCard], rng: random.Random | None = None) -> list[DrawnCard]:
    if len(cards) < 3:
        raise ValueError("Can it nhat 3 la de random.")

    local_rng = rng or random
    selected = local_rng.sample(cards, k=3)
    return [
        DrawnCard(
            card=selected[idx],
            position=POSITIONS[idx],
            orientation=local_rng.choice(ORIENTATIONS),
        )
        for idx in range(3)
    ]


class TarotInterpreter:
    def __init__(self) -> None:
        self.provider = (os.getenv("LLM_PROVIDER", "ollama") or "ollama").strip().lower()
        self.ollama_model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
        self.ollama_host = os.getenv("OLLAMA_HOST", "http://localhost:11434").rstrip("/")

    def interpret(self, question: str, drawn_cards: list[DrawnCard]) -> dict[str, Any]:
        if len(drawn_cards) != 3:
            raise ValueError("Input can dung 3 la bai.")

        if self.provider == "heuristic":
            parsed = self._heuristic_interpret(question, drawn_cards)
            parsed["provider"] = "heuristic"
            parsed["model"] = "fallback"
            return parsed

        if self.provider not in ("auto", "ollama"):
            parsed = self._heuristic_interpret(question, drawn_cards)
            parsed["provider"] = "heuristic"
            parsed["model"] = "fallback"
            parsed["warning"] = (
                f"LLM_PROVIDER='{self.provider}' khong hop le, da dung fallback heuristic. "
                "Gia tri hop le: ollama | auto | heuristic."
            )
            return parsed

        if self._ollama_is_available():
            try:
                parsed = self._interpret_ollama(question, drawn_cards)
                parsed["provider"] = "ollama"
                parsed["model"] = self.ollama_model
                return parsed
            except Exception:
                pass

        parsed = self._heuristic_interpret(question, drawn_cards)
        parsed["provider"] = "heuristic"
        parsed["model"] = "fallback"
        parsed["warning"] = (
            "Khong ket noi duoc Ollama, da dung fallback heuristic."
        )
        return parsed

    def _interpret_ollama(self, question: str, drawn_cards: list[DrawnCard]) -> dict[str, Any]:
        payload = {
            "model": self.ollama_model,
            "prompt": f"{SYSTEM_PROMPT}\n\n{self._build_user_prompt(question, drawn_cards)}",
            "stream": False,
            "format": "json",
        }
        request_data = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            url=f"{self.ollama_host}/api/generate",
            data=request_data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.URLError as exc:
            raise RuntimeError("Khong ket noi duoc Ollama.") from exc

        content = str(data.get("response", ""))
        return self._normalize_output(self._parse_json(content), drawn_cards)

    def _heuristic_interpret(self, question: str, drawn_cards: list[DrawnCard]) -> dict[str, Any]:
        card_meanings: list[dict[str, str]] = []
        position_signals: list[str] = []

        for item in drawn_cards:
            core_theme, action_hint = self._card_theme(item.card)
            position_hint = POSITION_LENSES.get(
                item.position, "day la mot tin hieu can duoc xu ly co chu dich"
            )
            orientation_hint = self._orientation_hint(item.orientation, action_hint)
            meaning = f"{item.card.name} noi bat ve {core_theme}. O vi tri {item.position}, {position_hint}. {orientation_hint}"
            card_meanings.append(
                {
                    "card": item.card.name,
                    "position": item.position,
                    "orientation": item.orientation,
                    "meaning": meaning,
                }
            )
            position_signals.append(f"{item.position.lower()}: {core_theme}")

        base_question = question.strip() or "cau hoi tong quan"
        major_count = sum(1 for x in drawn_cards if x.card.arcana == "Major Arcana")
        dominant_suit = self._dominant_minor_suit(drawn_cards)

        if major_count >= 2:
            arcana_line = (
                "Bo bai co nhieu Major Arcana, nen giai doan nay mang tinh buoc ngoat va quyet dinh huong di dai han."
            )
        else:
            arcana_line = (
                "Bo bai nghieng ve Minor Arcana, nghia la tien bo den tu dieu chinh thoi quen va cach lam moi ngay."
            )

        if dominant_suit:
            suit_cfg = SUIT_THEMES.get(dominant_suit)
            if suit_cfg:
                suit_line = (
                    f"Nang luong {dominant_suit} chiem uu the, can tap trung vao {suit_cfg['domain']} va uu tien {suit_cfg['focus']}."
                )
            else:
                suit_line = "Nang luong bo bai tuong doi can bang giua cac mat van de."
        else:
            suit_line = "Nang luong bo bai phan bo da dang, can giu cach tiep can can bang nhieu mat."

        combined = (
            f"{position_signals[0]}; {position_signals[1]}; {position_signals[2]}. "
            f"{arcana_line} {suit_line} Trong boi canh '{base_question}', uu tien lon nhat la "
            "chot mot huong hanh dong ro trong 1-2 tuan toi, sau do do lai ket qua de dieu chinh."
        )
        return {"card_meanings": card_meanings, "combined_meaning": combined}

    def _build_user_prompt(self, question: str, drawn_cards: list[DrawnCard]) -> str:
        lines = [
            "Question:",
            question.strip() or "(empty)",
            "",
            "Three cards:",
        ]
        for item in drawn_cards:
            suit = item.card.suit or "None"
            lines.append(
                f"- card={item.card.name}; position={item.position}; "
                f"orientation={item.orientation}; arcana={item.card.arcana}; suit={suit}"
            )
        lines.append("")
        lines.append(
            "Write card-by-card interpretation first, then one combined synthesis."
        )
        return "\n".join(lines)

    def _parse_json(self, content: str) -> dict[str, Any]:
        text = content.strip()
        if not text:
            raise ValueError("Model tra ve rong.")
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start == -1 or end == -1 or start >= end:
                raise
            return json.loads(text[start : end + 1])

    def _normalize_output(
        self, parsed: dict[str, Any], drawn_cards: list[DrawnCard]
    ) -> dict[str, Any]:
        normalized: list[dict[str, str]] = []
        candidates = parsed.get("card_meanings", [])

        for idx, drawn in enumerate(drawn_cards):
            if idx < len(candidates) and isinstance(candidates[idx], dict):
                meaning = str(candidates[idx].get("meaning", "")).strip()
                normalized.append(
                    {
                        "card": drawn.card.name,
                        "position": drawn.position,
                        "orientation": drawn.orientation,
                        "meaning": meaning or "Model khong tra ve y nghia ro rang.",
                    }
                )
                continue

            normalized.append(
                {
                    "card": drawn.card.name,
                    "position": drawn.position,
                    "orientation": drawn.orientation,
                    "meaning": "Model khong tra ve du y nghia cho la nay.",
                }
            )

        combined = str(parsed.get("combined_meaning", "")).strip()
        if not combined:
            combined = "Model khong tra ve y nghia tong hop ro rang."

        return {"card_meanings": normalized, "combined_meaning": combined}

    def _ollama_is_available(self) -> bool:
        request = urllib.request.Request(
            url=f"{self.ollama_host}/api/tags",
            headers={"Content-Type": "application/json"},
            method="GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=2):
                return True
        except Exception:
            return False

    def _card_theme(self, card: TarotCard) -> tuple[str, str]:
        if card.arcana == "Major Arcana":
            core, action = MAJOR_THEMES.get(
                card.name,
                ("moc chuyen bien quan trong tren hanh trinh ca nhan", "lam ro uu tien va hanh dong co ky luat"),
            )
            return core, action

        rank, suit = self._parse_minor_card_name(card)
        suit_cfg = SUIT_THEMES.get(
            suit,
            {
                "domain": "cac van de thuc te can duoc sap xep lai",
                "focus": "giu su ro rang trong lua chon",
            },
        )

        if rank in COURT_THEMES:
            court_core, court_action = COURT_THEMES[rank]
            core = f"{court_core} trong linh vuc {suit_cfg['domain']}"
            action = f"{court_action}; dong thoi {suit_cfg['focus']}"
            return core, action

        number_core, number_action = NUMBER_THEMES.get(
            rank,
            ("mau bai hoc dang duoc kich hoat", "xu ly tung buoc va uu tien tinh ro rang"),
        )
        core = f"{number_core} trong linh vuc {suit_cfg['domain']}"
        action = f"{number_action}; dong thoi {suit_cfg['focus']}"
        return core, action

    @staticmethod
    def _parse_minor_card_name(card: TarotCard) -> tuple[str, str]:
        if " of " in card.name:
            rank, suit = card.name.split(" of ", 1)
            return rank, suit
        return card.name, card.suit or ""

    @staticmethod
    def _orientation_hint(orientation: str, action_hint: str) -> str:
        if orientation == "Upright":
            return (
                "Trang thai upright cho thay dong nang luong nay van mo, "
                f"ban co the day nhanh theo huong: {action_hint}."
            )
        return (
            "Trang thai reversed cho thay co diem nghen tam thoi; "
            f"uu tien giam toc, ra soat gia dinh va sau do moi {action_hint}."
        )

    @staticmethod
    def _dominant_minor_suit(drawn_cards: list[DrawnCard]) -> str | None:
        suits = [x.card.suit for x in drawn_cards if x.card.suit]
        if not suits:
            return None
        top_suit, top_count = Counter(suits).most_common(1)[0]
        if top_count < 2:
            return None
        return top_suit
