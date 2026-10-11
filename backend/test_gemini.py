
import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types


# ==========================================
# 1. LOAD THE API KEY
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")

API_KEY = os.getenv("GEMINI_API_KEY")

MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-2.5-flash-lite"
)

if not API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is missing from .env"
    )


# ==========================================
# 2. CONNECT TO GOOGLE GEMINI
# ==========================================

client = genai.Client(
    api_key=API_KEY
)


# ==========================================
# 3. SEND A TEST QUESTION
# ==========================================

print("Connecting to Google Gemini AI...")

try:
    response = client.models.generate_content(
        model=MODEL,

        contents=(
            "Explain Pearson correlation "
            "in one simple sentence."
        ),

        config=types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=256
        )
    )

    # ======================================
    # 4. DISPLAY THE AI RESPONSE
    # ======================================

    print("\nGEMINI AI RESPONSE")
    print("====================")

    print(
        response.text
        or "No text response returned."
    )

except Exception as error:
    print("\nGemini request failed.")
    print("Error type:", type(error).__name__)
    print("Details:", str(error))

finally:
    client.close()
