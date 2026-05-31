import re


def clean_text(text: str) -> str:
    text = _normalize_newlines(text)
    text = _remove_production_notes(text)
    text = _remove_speaker_labels(text)
    text = _remove_markdown(text)
    text = _normalize_repeated_punctuation(text)
    text = _normalize_symbols(text)
    text = _remove_urls(text)
    text = _normalize_brackets(text)
    text = _normalize_whitespace(text)
    text = text.strip()
    return text


def _normalize_newlines(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return text


def _remove_production_notes(text: str) -> str:
    patterns = [
        r"\[pause\]",
        r"\[show image\]",
        r"\[?B-roll\]?",
        r"\[music\]",
        r"\[sound effect\]",
        r"\(camera zooms in\)",
        r"\(camera pans\)",
        r"\(cut to.*?\)",
        r"\(voiceover\)",
        r"\(VO\)",
        r"\[.*?\b(pause|music|sfx|sound|effect|roll|image|cut|scene)\b.*?\]",
    ]
    for pat in patterns:
        text = re.sub(pat, "", text, flags=re.IGNORECASE)
    return text


def _remove_speaker_labels(text: str) -> str:
    labels = [
        r"^HOST:",
        r"^Narrator:",
        r"^Scene:",
        r"^Intro:",
        r"^Outro:",
        r"^Speaker \d+:",
        r"^\[.*?\]:",
    ]
    for pat in labels:
        text = re.sub(pat, "", text, flags=re.MULTILINE | re.IGNORECASE)
    return text


def _remove_markdown(text: str) -> str:
    lines = text.split("\n")
    cleaned = []
    for line in lines:
        stripped = line.strip()
        if re.match(r"^#{1,6}\s", stripped):
            continue
        if re.match(r"^\*{1,3}\s", stripped):
            continue
        if re.match(r"^---+\s*$", stripped):
            continue
        if re.match(r"^___+\s*$", stripped):
            continue
        if re.match(r"^```", stripped):
            continue
        cleaned.append(line)
    text = "\n".join(cleaned)
    text = re.sub(r"\*{1,3}(.+?)\*{1,3}", r"\1", text)
    text = re.sub(r"`{1,3}(.+?)`{1,3}", r"\1", text)
    return text


def _normalize_repeated_punctuation(text: str) -> str:
    text = re.sub(r":{2,}", ".", text)
    text = re.sub(r"\.{3,}", ".", text)
    text = re.sub(r",{3,}", ",", text)
    text = re.sub(r"!{3,}", "!", text)
    text = re.sub(r"\?{3,}", "?", text)
    text = re.sub(r"!+\?+", "?", text)
    text = re.sub(r"\?+!+", "?", text)
    return text


def _normalize_symbols(text: str) -> str:
    text = re.sub(r"&(?=\s)", "and", text)
    text = re.sub(r"(?<=\s)&(?=\s)", "and", text)
    text = re.sub(r"%", " percent", text)
    text = re.sub(r"\$(\d+)", r"\1 dollars", text)
    return text


def _remove_urls(text: str) -> str:
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"www\.\S+", "", text)
    return text


def _normalize_brackets(text: str) -> str:
    text = re.sub(r"\(.*?\)", "", text)
    text = re.sub(r"\[.*?\]", "", text)
    return text


def _normalize_whitespace(text: str) -> str:
    text = re.sub(r" {2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text
