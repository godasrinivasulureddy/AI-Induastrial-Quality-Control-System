
from app.database.base import Base, engine
from app.models.user import User  # Ensure User model is imported so Base knows about it
from app.models.prediction import Prediction # Ensure Prediction model is imported

# Function to create all tables (for development/initial setup)
def create_db_tables():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created.")

if __name__ == "__main__":
    # Example: Run this file to create tables if using SQLite
    # For production, use Alembic migrations instead.
    create_db_tables()
