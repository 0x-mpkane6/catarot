from __future__ import annotations

from typing import Any

import gradio as gr

from src.pipeline.tarot_pipeline import TarotPipeline


def _extract_paths(files: Any) -> list[str]:
    if not files:
        return []
    if isinstance(files, str):
        return [files]

    paths: list[str] = []
    if isinstance(files, (list, tuple)):
        for item in files:
            if item is None:
                continue
            if isinstance(item, str):
                paths.append(item)
            elif isinstance(item, dict) and item.get("path"):
                paths.append(str(item["path"]))
            elif hasattr(item, "name"):
                paths.append(str(item.name))
            else:
                paths.append(str(item))
        return [path for path in paths if path]

    if hasattr(files, "name"):
        return [str(files.name)]

    return [str(files)]


def _choice_value(candidate: dict) -> str:
    return f"{candidate.get('name','Unknown')}||{candidate.get('orientation','upright')}"


def _choice_label(candidate: dict) -> str:
    score = float(candidate.get("score", 0.0))
    return f"{candidate.get('name','Unknown')} ({candidate.get('orientation','upright')}) [{score:.3f}]"


def _parse_choice(choice: str | None) -> dict | None:
    if not choice or "||" not in choice:
        return None
    name, orientation = choice.split("||", 1)
    orientation = orientation.strip().lower()
    if orientation not in {"upright", "reversed"}:
        return None
    return {"name": name.strip(), "orientation": orientation}


def _warnings_text(warnings: list[str]) -> str:
    if not warnings:
        return "No warnings."
    return "\n".join(f"- {message}" for message in warnings)


def build_app() -> gr.Blocks:
    pipeline = TarotPipeline()

    def _run(question: str, audio_file: str | None, image_files: Any, spread_type: str):
        image_paths = _extract_paths(image_files)
        result = pipeline.run_pipeline(
            question=question,
            audio_path=audio_file,
            image_paths=image_paths,
            spread_type=spread_type,
        )

        dropdown_updates = []
        for idx in range(3):
            if idx >= len(result["cards"]):
                dropdown_updates.append(gr.update(visible=False, choices=[], value=None, label=f"Card {idx+1}"))
                continue

            card = result["cards"][idx]
            candidates = card.get("topk_candidates", [])
            is_low_conf = float(card.get("confidence", 0.0)) < pipeline.confidence_threshold
            choices = [(_choice_label(c), _choice_value(c)) for c in candidates]
            default_value = choices[0][1] if choices else None
            label = f"{card.get('position', f'Card {idx+1}')} selection"
            dropdown_updates.append(
                gr.update(
                    visible=is_low_conf and bool(choices),
                    choices=choices,
                    value=default_value,
                    label=label,
                )
            )

        return (
            result,
            result["final_answer"],
            _warnings_text(result["warnings"]),
            result,
            *dropdown_updates,
        )

    def _apply_selection(
        question: str,
        audio_file: str | None,
        image_files: Any,
        spread_type: str,
        choice_1: str | None,
        choice_2: str | None,
        choice_3: str | None,
    ):
        raw_choices = [choice_1, choice_2, choice_3]
        overrides = {}
        for idx, raw in enumerate(raw_choices):
            parsed = _parse_choice(raw)
            if parsed:
                overrides[idx] = parsed

        image_paths = _extract_paths(image_files)
        result = pipeline.run_pipeline(
            question=question,
            audio_path=audio_file,
            image_paths=image_paths,
            spread_type=spread_type,
            card_overrides=overrides or None,
        )

        dropdown_updates = []
        for idx in range(3):
            if idx >= len(result["cards"]):
                dropdown_updates.append(gr.update(visible=False, choices=[], value=None, label=f"Card {idx+1}"))
                continue
            card = result["cards"][idx]
            candidates = card.get("topk_candidates", [])
            choices = [(_choice_label(c), _choice_value(c)) for c in candidates]
            selected_value = None
            for candidate in candidates:
                if (
                    candidate.get("name") == card.get("name")
                    and candidate.get("orientation") == card.get("orientation")
                ):
                    selected_value = _choice_value(candidate)
                    break
            label = f"{card.get('position', f'Card {idx+1}')} selection"
            is_low_conf = float(card.get("confidence", 0.0)) < pipeline.confidence_threshold
            dropdown_updates.append(
                gr.update(
                    visible=is_low_conf and bool(choices),
                    choices=choices,
                    value=selected_value,
                    label=label,
                )
            )

        return (
            result,
            result["final_answer"],
            _warnings_text(result["warnings"]),
            result,
            *dropdown_updates,
        )

    with gr.Blocks(title="Tarot Multimodal MVP") as demo:
        gr.Markdown("## Tarot Multimodal MVP")

        with gr.Row():
            question = gr.Textbox(label="Question", lines=2, placeholder="Ask your tarot question...")
            spread_type = gr.Dropdown(
                label="Spread Type",
                choices=["single", "three"],
                value="single",
            )

        with gr.Row():
            audio_file = gr.Audio(label="Optional Audio", type="filepath")
            image_files = gr.Files(label="Upload 1 image (single) or up to 3 images (three)", file_types=["image"])

        with gr.Row():
            run_btn = gr.Button("Run Demo", variant="primary")
            apply_btn = gr.Button("Apply Selected Candidates")

        with gr.Row():
            choice_1 = gr.Dropdown(label="Card 1 selection", visible=False)
            choice_2 = gr.Dropdown(label="Card 2 selection", visible=False)
            choice_3 = gr.Dropdown(label="Card 3 selection", visible=False)

        warnings_box = gr.Markdown(label="Warnings")
        final_answer = gr.Markdown(label="Final Answer")
        json_output = gr.JSON(label="Output JSON")

        state = gr.State()

        run_btn.click(
            fn=_run,
            inputs=[question, audio_file, image_files, spread_type],
            outputs=[json_output, final_answer, warnings_box, state, choice_1, choice_2, choice_3],
        )

        apply_btn.click(
            fn=_apply_selection,
            inputs=[question, audio_file, image_files, spread_type, choice_1, choice_2, choice_3],
            outputs=[json_output, final_answer, warnings_box, state, choice_1, choice_2, choice_3],
        )

    return demo


def launch_app(share: bool = False) -> None:
    app = build_app()
    app.launch(share=share)
