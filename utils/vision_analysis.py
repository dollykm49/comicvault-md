from openai import OpenAI
import base64
from io import BytesIO

client = OpenAI()

def analyze_comic_cover(pil_image):
    """
    Uses GPT-4o Vision model to extract comic book metadata.
    """

    # Convert image to base64
    buffered = BytesIO()
    pil_image.save(buffered, format="PNG")
    img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

    prompt = """
You are a comic book expert. Analyze this comic cover and extract:

- Title
- Issue Number
- Publisher
- Publication Year
- Variant (if any)
- Key Characters appearing
- Key events or story arc
- Artist / Writer (if visible on cover)
- Notable markings or features

If unsure, give your best guess.
Return JSON ONLY.
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{img_b64}"
                        }
                    },
                ]
            }
        ]
    )

    result = response.choices[0].message.content

    # Convert OpenAI text into Python dict safely
    import json
    return json.loads(result)
