from app.shared.infrastructure.database import SessionLocal
from app.modules.products.infrastructure.models import Category

def seed_initial_categories():
    """Popula categorias padrão no banco caso não existam."""
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

if __name__ == "__main__":
    seed_initial_categories()
    print("Categorias iniciais populadas com sucesso.")
