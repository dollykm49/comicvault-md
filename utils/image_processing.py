from PIL import Image
from io import BytesIO

def load_image_as_pillow(image_bytes: bytes) -> Image.Image:
    """
    Convert raw image bytes to a PIL Image object.
    
    Args:
        image_bytes: Raw bytes from uploaded file
        
    Returns:
        PIL Image object
        
    Raises:
        ValueError: If image cannot be loaded
    """
    try:
        image = Image.open(BytesIO(image_bytes))
        
        # Convert to RGB if necessary (handles RGBA, grayscale, etc.)
        if image.mode not in ('RGB', 'L'):
            image = image.convert('RGB')
            
        return image
    except Exception as e:
        raise ValueError(f"Failed to load image: {str(e)}")


def resize_image(image: Image.Image, max_size: tuple = (1024, 1024)) -> Image.Image:
    """
    Resize image while maintaining aspect ratio.
    
    Args:
        image: PIL Image object
        max_size: Maximum (width, height) tuple
        
    Returns:
        Resized PIL Image object
    """
    image.thumbnail(max_size, Image.Resampling.LANCZOS)
    return image


def validate_image_format(image: Image.Image, allowed_formats: list = None) -> bool:
    """
    Validate image format.
    
    Args:
        image: PIL Image object
        allowed_formats: List of allowed formats (e.g., ['JPEG', 'PNG'])
        
    Returns:
        True if valid, False otherwise
    """
    if allowed_formats is None:
        allowed_formats = ['JPEG', 'PNG', 'JPG', 'WEBP']
        
    return image.format in allowed_formats


def optimize_image_for_api(image: Image.Image, max_size: tuple = (1024, 1024), quality: int = 85) -> bytes:
    """
    Optimize image for API transmission.
    
    Args:
        image: PIL Image object
        max_size: Maximum dimensions
        quality: JPEG quality (1-100)
        
    Returns:
        Optimized image bytes
    """
    # Resize if needed
    if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
        image = resize_image(image, max_size)
    
    # Convert to RGB if needed
    if image.mode not in ('RGB', 'L'):
        image = image.convert('RGB')
    
    # Save to bytes
    buffer = BytesIO()
    image.save(buffer, format='JPEG', quality=quality, optimize=True)
    return buffer.getvalue()
