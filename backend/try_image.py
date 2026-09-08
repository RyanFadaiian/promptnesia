import base64
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

backend = Path(__file__).resolve().parent
load_dotenv(backend / ".env")

client = OpenAI()

print("Generating image...")

result = client.images.generate(
    model="gpt-image-2",
    prompt="Generate a silly, absurd meme-style cartoon of a fictional adult man named Albin causing an exaggerated bathroom disaster, with poop comically appearing all around him in an over-the-top, non-realistic way. Albin is Indian, shown neutrally with no stereotypes or derogatory features. Use goofy facial expressions, cartoon physics, and a lighthearted meme aesthetic. No graphic anatomical detail.",
)

image_bytes = base64.b64decode(result.data[0].b64_json)
output = backend / "test-image2.png"
output.write_bytes(image_bytes)

print(f"Image saved to: {output}")