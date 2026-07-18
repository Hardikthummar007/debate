import os

# Resolve path to .env file relative to this file or working directory
def load_env():
    # Try local .env in the current working directory or one level up
    env_paths = [".env", "../.env", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")]
    for path in env_paths:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        os.environ[key.strip()] = val.strip().strip('"').strip("'")
            break

load_env()

# SECURITY: check that tokens are set.
if "GEMINI_API_KEY" not in os.environ and "GOOGLE_API_KEY" not in os.environ:
    raise RuntimeError(
        "Set GEMINI_API_KEY or GOOGLE_API_KEY as an environment variable or in a local .env file before running."
    )

# Standardize key names to avoid warnings from langchain-google-genai
if "GEMINI_API_KEY" in os.environ and "GOOGLE_API_KEY" not in os.environ:
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]
elif "GOOGLE_API_KEY" in os.environ and "GEMINI_API_KEY" not in os.environ:
    os.environ["GEMINI_API_KEY"] = os.environ["GOOGLE_API_KEY"]

if "HUGGINGFACEHUB_API_TOKEN" not in os.environ:
    raise RuntimeError(
        "Set HUGGINGFACEHUB_API_TOKEN as an environment variable or in a local .env file before running (needed for RAG embeddings)."
    )

ROUNDS = 2

# --- TOPIC GATE ---
OFF_TOPIC_TOPIC_SCORE_CAP = 10.0
TOPIC_GATE_THRESHOLD = 40.0
OFF_TOPIC_FINAL_SCORE_CAP = 30.0

# --- STANCE GATE ---
OFF_STANCE_FINAL_SCORE_CAP = 30.0
STANCE_VIOLATION_SCORE_CAP = 10.0
STANCE_GATE_THRESHOLD = 40.0

# --- WEIGHTS ---
WEIGHTS = {
    "topic": 0.10,
    "stance": 0.25,
    "related": 0.20,
    "fact": 0.25,
    "novelty": 0.10,
    "delivery": 0.10,
}
