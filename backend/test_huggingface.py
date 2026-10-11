
import os

from pathlib import Path
from dotenv import load_dotenv
from huggingface_hub import InferenceClient


# ==========================================
# 1. LOAD ENVIRONMENT VARIABLES
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")

HF_TOKEN = os.getenv("HF_TOKEN")
HF_MODEL = os.getenv(
    "HF_MODEL",
    "openai/gpt-oss-20b"
)

if not HF_TOKEN:
    raise RuntimeError(
        "HF_TOKEN is missing from backend/.env"
    )


# ==========================================
# 2. CONNECT TO HUGGING FACE CLOUD AI
# ==========================================

client = InferenceClient(
    api_key=HF_TOKEN,
    provider="auto"
)


# ==========================================
# 3. ASK A TEST QUESTION
# ==========================================

print("Connecting to Hugging Face Cloud AI...")

response = client.chat.completions.create(
    model=HF_MODEL,

    messages=[
        {
            "role": "system",
            "content": (
                "You are an educational research "
                "assistant. Explain concepts in "
                "simple English."
            )
        },
        {
            "role": "user",
            "content": (
                "Explain Pearson correlation "
                "in one simple sentence."
            )
        }
    ],

    max_tokens=160
)


# ==========================================
# 4. DISPLAY THE AI ANSWER
# ==========================================

answer = response.choices[0].message.content

print("\nHUGGING FACE AI RESPONSE")
print("========================")
print(answer)
