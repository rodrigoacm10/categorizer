from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.shared.infrastructure.database import Base, engine, SessionLocal
from app.modules.products.interfaces.router import router as products_router
from app.modules.inventory.interfaces.router import router as inventory_router
from app.modules.products.infrastructure.models import Category

# Cria todas as tabelas no banco de dados na inicialização
Base.metadata.create_all(bind=engine)

def seed_initial_categories():
    db = SessionLocal()
    try:
        count = db.query(Category).count()
        if count == 0:
            default_categories = [
                Category(name="Matéria-Prima", description="Insumos básicos de produção", color="#10B981"),
                Category(name="Embalagens", description="Caixas, fitas e recipientes", color="#F59E0B"),
                Category(name="Componentes", description="Peças e componentes diversos", color="#3B82F6"),
                Category(name="Material de Escritório", description="Uso interno e administrativo", color="#8B5CF6"),
            ]
            db.add_all(default_categories)
            db.commit()
    finally:
        db.close()

seed_initial_categories()

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
