import re
from app.config import MAX_CHUNK_CHARS


def chunk_text(text: str, max_chars: int = None) -> list[str]:
    if max_chars is None:
        max_chars = MAX_CHUNK_CHARS

    paragraphs = _split_paragraphs(text)
    chunks = []

    for para in paragraphs:
        if len(para) <= max_chars:
            chunks.append(para)
        else:
            chunks.extend(_split_paragraph(para, max_chars))

    return chunks


def _split_paragraphs(text: str) -> list[str]:
    paras = re.split(r"\n\s*\n", text.strip())
    return [p.strip() for p in paras if p.strip()]


def _split_paragraph(paragraph: str, max_chars: int) -> list[str]:
    sentences = _split_sentences(paragraph)
    chunks = []
    current = []

    for sentence in sentences:
        candidate = " ".join(current + [sentence]) if current else sentence
        if len(candidate) <= max_chars:
            current.append(sentence)
        else:
            if current:
                chunks.append(" ".join(current))
            current = [sentence]

    if current:
        chunks.append(" ".join(current))

    return chunks


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [p.strip() for p in parts if p.strip()]
