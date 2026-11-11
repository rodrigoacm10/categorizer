from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.shared.domain.exceptions import ProblemDetailsException
from app.modules.auth.interfaces.router import router as auth_router
from app.modules.tenants.interfaces.router import router as tenants_router
from app.modules.products.interfaces.router import router as products_router
from app.modules.inventory.interfaces.router import router as inventory_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API de Gestão de Estoque com Clean Architecture Modular, Multi-Tenancy Estrito, Ledger Imutável e Idempotência Garantida pelo Backend"
)

# Handler padronizado RFC 7807 para ProblemDetails
@app.exception_handler(ProblemDetailsException)
async def problem_details_handler(request: Request, exc: ProblemDetailsException):
    payload = exc.to_dict()
    if not payload.get("instance"):
        payload["instance"] = request.url.path
    headers = getattr(exc, "headers", None)
    return JSONResponse(status_code=exc.status_code, content=payload, headers=headers)

# Configuração de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Cache", "X-Idempotency-Key", "X-Tenant-ID"]
)

# Rotas
app.include_router(auth_router, prefix="/api")
app.include_router(tenants_router, prefix="/api")
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
