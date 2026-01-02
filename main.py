import os
import sys
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Log startup
logger.info("=" * 60)
logger.info("Comic Vault API - Starting up...")
logger.info("=" * 60)

# Create FastAPI app
app = FastAPI(
    title="Comic Vault API",
    description="Backend API for Comic Vault - AI-powered comic book identification and grading",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

logger.info("✅ FastAPI app created successfully")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info("✅ CORS middleware configured")

# Try to import and include routers
try:
    from routes.identify import router as identify_router
    app.include_router(identify_router, tags=["Identification"])
    logger.info("✅ Identification router loaded successfully")
except Exception as e:
    logger.error(f"❌ Failed to load identification router: {e}")
    logger.error("API will start but /api/comics/identify endpoint will not be available")

# Check environment variables
openai_key = os.getenv("OPENAI_API_KEY")
if openai_key:
    logger.info(f"✅ OPENAI_API_KEY is configured (starts with: {openai_key[:10]}...)")
else:
    logger.warning("⚠️  OPENAI_API_KEY is not set - AI features will not work")

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint - returns API information"""
    logger.info("Root endpoint accessed")
    return {
        "message": "Comic Vault API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "identify": "/api/comics/identify"
        }
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint - returns service status"""
    logger.info("Health check endpoint accessed")
    
    # Check OpenAI configuration
    openai_configured = bool(os.getenv("OPENAI_API_KEY"))
    
    # Check if routes are loaded
    routes_loaded = any(route.path == "/api/comics/identify" for route in app.routes)
    
    return {
        "status": "healthy",
        "openai_configured": openai_configured,
        "routes_loaded": routes_loaded,
        "python_version": sys.version,
        "environment": os.getenv("ENVIRONMENT", "production")
    }

# Startup event
@app.on_event("startup")
async def startup_event():
    """Log startup information"""
    logger.info("=" * 60)
    logger.info("🚀 Comic Vault API is ready!")
    logger.info("=" * 60)
    logger.info("Available endpoints:")
    for route in app.routes:
        if hasattr(route, 'methods') and hasattr(route, 'path'):
            methods = ', '.join(route.methods)
            logger.info(f"  {methods:10} {route.path}")
    logger.info("=" * 60)

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Log shutdown information"""
    logger.info("Comic Vault API is shutting down...")

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Handle all unhandled exceptions"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc),
            "path": str(request.url)
        }
    )

if __name__ == "__main__":
    import uvicorn
    
    # Get port from environment or use default
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting server on {host}:{port}")
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info"
    )
