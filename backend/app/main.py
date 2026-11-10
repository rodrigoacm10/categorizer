from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.modules.products.interfaces.router import router as products_router
from app.modules.inventory.interfaces.router import router as inventory_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API de Gestão de Estoque com Clean Architecture Modular, Ledger Imutável e Idempotência Garantida pelo Backend"
)

# Configuração de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Cache", "X-Idempotency-Key"]
)

# Rotas
app.include_router(products_router, prefix="/api", tags=["Produtos & Categorias"])
app.include_router(inventory_router, prefix="/api/inventory", tags=["Estoque & Ledger"])

@app.get("/api/health", tags=["Status"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "scale_factor": settings.QUANTITY_SCALE
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
