
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class Detection(BaseModel):
    label: str
    confidence: float
    box: BoundingBox
    bbox: Optional[List[float]] = None
    class_id: Optional[int] = None

# Shared properties
class PredictionBase(BaseModel):
    image_path: Optional[str] = None
    prediction_label: Optional[str] = None
    confidence_score: Optional[float] = None
    source: Optional[str] = None
    model_version: Optional[str] = None
    heatmap_path: Optional[str] = None
    detections: Optional[List[Detection]] = None

# Properties to receive via API on creation
class PredictionCreate(PredictionBase):
    image_path: str
    prediction_label: str
    confidence_score: float

# Properties to return to client (with database generated fields)
class Prediction(PredictionBase):
    id: int
    timestamp: datetime
    owner_id: int

    class Config:
        from_attributes = True # Was orm_mode in older Pydantic


class FramePredictionRequest(BaseModel):
    image_data: str
    product_type: str = "mobile"
    confidence_threshold: float = 0.55
    save_detection: bool = False


class InferenceResponse(BaseModel):
    prediction_label: str
    confidence_score: float
    source: str
    model_version: str
    object_detection_available: bool
    object_model_version: Optional[str] = None
    detections: List[Detection]
    heatmap_path: Optional[str] = None
    timestamp: datetime
    fps: Optional[float] = None
    processing_ms: Optional[float] = None
