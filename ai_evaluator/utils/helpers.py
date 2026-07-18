from typing import List

def is_gibberish_or_empty(text: str) -> bool:
    cleaned = text.strip()
    if not cleaned:
        return True
    if len(cleaned) < 4:
        return True
    words = cleaned.split()
    if len(words) < 2 and len(cleaned) < 15:
        return True
    return False

def format_arguments_list(args: List[str]) -> str:
    if not args:
        return "None (This is the first argument, so there is no history yet)."
    return "\n".join(f"- {arg}" for arg in args)

def safe_float(val, default=50.0) -> float:
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

def safe_bool(val, default=True) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() in ("true", "yes", "1")
    return default

def norm(x) -> float:
    try:
        return max(0.0, min(100.0, float(x)))
    except (ValueError, TypeError):
        return 50.0
