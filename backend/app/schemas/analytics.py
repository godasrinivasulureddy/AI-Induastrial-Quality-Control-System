from typing import Any, Dict, List

from pydantic import BaseModel


class AnalyticsSummary(BaseModel):
    total_predictions: int
    defective_count: int
    non_defective_count: int
    defect_rate: float
    average_confidence: float
    prediction_rate_per_hour: float
    distribution: List[Dict[str, Any]]
    confidence_bands: List[Dict[str, Any]]
    monthly_trends: List[Dict[str, Any]]
    insights: List[str]
    recommendations: List[str]
