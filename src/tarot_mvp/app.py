from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import gradio as gr

from .data import load_tarot_cards
from .engine import DrawnCard, TarotInterpreter, draw_three_cards

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_FILE = ROOT_DIR / "data" / "raw" / "tarot_json" / "tarot-images.json"
CARDS_DIR = ROOT_DIR / "data" / "raw" / "tarot_json" / "cards"

if load_dotenv:
    load_dotenv(ROOT_DIR / ".env")

ALL_CARDS = load_tarot_cards(DATA_FILE)
INTERPRETER = TarotInterpreter()


def _cards_markdown(drawn_cards: list[DrawnCard]) -> str:
    lines = ["### 3 la bai da rut", ""]
    for card in drawn_cards:
        suit = card.card.suit or "-"
        lines.append(
            f"- **{card.position}**: {card.card.name} ({card.orientation}) | "
            f"{card.card.arcana} | suit: {suit}"
        )
    return "\n".join(lines)


def _gallery_items(drawn_cards: list[DrawnCard]) -> list[tuple[str, str]]:
    items: list[tuple[str, str]] = []
    for card in drawn_cards:
        if card.card.image_file:
            img_path = CARDS_DIR / card.card.image_file
            if img_path.exists():
                items.append((str(img_path), f"{card.position}: {card.card.name}"))
    return items


def _render_card_meanings(items: list[dict[str, str]]) -> str:
    lines = ["### Y nghia tung la", ""]
    for idx, item in enumerate(items, start=1):
        lines.append(
            f"{idx}. **{item['position']} - {item['card']} ({item['orientation']})**\n"
            f"{item['meaning']}"
        )
    return "\n\n".join(lines)


def on_draw() -> tuple[list[dict[str, Any]], str, list[tuple[str, str]], str, str, str]:
    drawn_cards = draw_three_cards(ALL_CARDS)
    state = [card.to_state() for card in drawn_cards]
    cards_md = _cards_markdown(drawn_cards)
    gallery = _gallery_items(drawn_cards)
    return state, cards_md, gallery, "", "", ""


def on_interpret(
    question: str, state: list[dict[str, Any]]
) -> tuple[str, str, str]:
    if not state:
        return "", "", "Ban can bam `Random 3 la` truoc."

    drawn_cards = [DrawnCard.from_state(payload) for payload in state]
    result = INTERPRETER.interpret(question=question or "", drawn_cards=drawn_cards)

    card_md = _render_card_meanings(result["card_meanings"])
    combined_md = "### Y nghia tong hop\n\n" + result["combined_meaning"]
    provider_md = f"Model provider: `{result['provider']}` | model: `{result['model']}`"
    warning = result.get("warning")
    if warning:
        provider_md += f"\n\nLuu y: {warning}"
    return card_md, combined_md, provider_md


def build_demo() -> gr.Blocks:
    with gr.Blocks(title="Tarot 3-Card MVP") as demo:
        gr.Markdown(
            """
            # Tarot 3-Card MVP
            1. Bam `Random 3 la`
            2. Nhap cau hoi (tuy chon)
            3. Bam `Giai nghia 3 la`
            """
        )

        question = gr.Textbox(
            label="Cau hoi cua ban (tuy chon)",
            placeholder="Vi du: Cong viec cua toi trong 3 thang toi se ra sao?",
        )

        with gr.Row():
            draw_btn = gr.Button("Random 3 la", variant="primary")
            read_btn = gr.Button("Giai nghia 3 la")

        state = gr.State([])
        cards_md = gr.Markdown("Chua co la bai. Bam `Random 3 la` de bat dau.")
        gallery = gr.Gallery(label="3 la bai", columns=3, rows=1, height=260)
        card_meanings_md = gr.Markdown()
        combined_md = gr.Markdown()
        provider_md = gr.Markdown()

        draw_btn.click(
            fn=on_draw,
            inputs=[],
            outputs=[state, cards_md, gallery, card_meanings_md, combined_md, provider_md],
        )

        read_btn.click(
            fn=on_interpret,
            inputs=[question, state],
            outputs=[card_meanings_md, combined_md, provider_md],
        )

    return demo


def launch_app() -> None:
    demo = build_demo()
    server_name = os.getenv("GRADIO_SERVER_NAME", "127.0.0.1")
    server_port = int(os.getenv("GRADIO_SERVER_PORT", "7860"))
    demo.launch(server_name=server_name, server_port=server_port, share=False)
