
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database.base import Base

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    image_path = Column(String, index=True)
    prediction_label = Column(String)
    confidence_score = Column(Float)
    source = Column(String, default="heuristic")
    model_version = Column(String, default="fallback-cv-v1")
    heatmap_path = Column(String, nullable=True)
    detections_json = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="predictions")

    @property
    def detections(self):
        import json
        if self.detections_json:
            try:
                return json.loads(self.detections_json)
            except Exception:
                return []
        return []

