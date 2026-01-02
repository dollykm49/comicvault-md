from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse
from utils.image_processing import load_image_as_pillow
from utils.vision_analysis import analyze_comic_cover

router = APIRouter()

@router.post("/api/comics/identify")
async def identify_comic(
    image: UploadFile = File(...),
    user_id: str = Form(...)
):
    """
    Identify comic title, issue, publisher, and metadata using AI vision.
    """

    try:
        # Load uploaded image as PIL object
        pil_image = load_image_as_pillow(await image.read())

        # Run AI-based recognition
        identification = analyze_comic_cover(pil_image)

        return {
            "user_id": user_id,
            "metadata": identification
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Identification error: {str(e)}"}
        )
