"""Semantic B-roll search: embeds a storyboard's visual-direction text with
OpenCLIP and runs a cosine-similarity lookup against a pgvector-indexed
stock clip catalog (`b_roll_library`, HNSW index).

Requires the optional `torch`/`open_clip_torch` dependencies.
"""
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

CLIP_MODEL_NAME = "ViT-B-32"
CLIP_PRETRAINED = "laion2b_s34b_b79k"

_clip_model = None
_clip_preprocess = None
_clip_tokenizer = None


def _get_clip_engine():
    global _clip_model, _clip_preprocess, _clip_tokenizer
    if _clip_model is None:
        import open_clip
        import torch

        device = "cuda" if torch.cuda.is_available() else "cpu"
        model, _, preprocess = open_clip.create_model_and_transforms(
            CLIP_MODEL_NAME, pretrained=CLIP_PRETRAINED, device=device
        )
        _clip_model = model.eval()
        _clip_preprocess = preprocess
        _clip_tokenizer = open_clip.get_tokenizer(CLIP_MODEL_NAME)
    return _clip_model, _clip_preprocess, _clip_tokenizer


class SemanticBRollMatcher:
    @classmethod
    def encode_text_prompt(cls, prompt: str) -> List[float]:
        import torch

        model, _, tokenizer = _get_clip_engine()
        device = next(model.parameters()).device
        with torch.no_grad():
            tokens = tokenizer([prompt]).to(device)
            features = model.encode_text(tokens)
            features /= features.norm(dim=-1, keepdim=True)
            return features.cpu().numpy()[0].tolist()

    @classmethod
    def find_matching_clips(
        cls,
        db: Session,
        scene_description: str,
        required_duration: float = 3.0,
        top_k: int = 5,
        exclude_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        embedding = cls.encode_text_prompt(scene_description)
        embedding_str = f"[{','.join(str(x) for x in embedding)}]"

        exclude_clause = "AND id NOT IN :exclude_ids" if exclude_ids else ""
        params: Dict[str, Any] = {
            "embedding": embedding_str,
            "min_duration": required_duration,
            "limit": top_k,
        }
        if exclude_ids:
            params["exclude_ids"] = tuple(exclude_ids)

        rows = db.execute(
            text(
                f"""
                SELECT id, file_url, duration_seconds, tags,
                       1 - (embedding <=> :embedding::vector) AS similarity_score
                FROM b_roll_library
                WHERE duration_seconds >= :min_duration
                {exclude_clause}
                ORDER BY embedding <=> :embedding::vector ASC
                LIMIT :limit;
                """
            ),
            params,
        ).fetchall()

        return [
            {
                "clip_id": row.id,
                "file_url": row.file_url,
                "duration_seconds": float(row.duration_seconds),
                "tags": row.tags,
                "similarity_score": round(float(row.similarity_score), 4),
            }
            for row in rows
        ]
