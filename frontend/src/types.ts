export type UserRole = "student" | "faculty" | "engineer" | "admin";

export interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  is_admin: boolean;
  role: UserRole | string;
  avatar_url?: string | null;
}

export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  label: string;
  confidence: number;
  box: DetectionBox;
  bbox?: number[];
  class_id?: number;
}

export interface Prediction {
  id: number;
  image_path: string;
  prediction_label: string;
  confidence_score: number;
  source?: string;
  model_version?: string;
  heatmap_path?: string | null;
  detections?: Detection[];
  timestamp: string;
  owner_id: number;
}

export interface ClassifyResponse {
  product: string;
  predicted_class: string;
  confidence: number;
  model_used: string;
  model_version: string;
  prediction_id: number;
  job_id: string;
  image_path: string;
  timestamp: string;
  review_required: boolean;
  model_uncertain: boolean;
}

export interface InferenceResponse {
  prediction_label: string;
  confidence_score: number;
  review_required?: boolean;
  model_uncertain?: boolean;
  product_detected?: boolean;
  product_detection_warning?: string | null;
  source: string;
  model_version: string;
  object_detection_available?: boolean;
  object_model_version?: string | null;
  detections: Detection[];
  heatmap_path?: string | null;
  timestamp: string;
  fps?: number;
  processing_ms?: number;
}

export interface Activity {
  id: number;
  user_id: number;
  activity_type: string;
  description?: string | null;
  timestamp: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  level: "info" | "success" | "warning" | "error" | string;
  is_read: boolean;
  created_at: string;
}

export interface AnalyticsSummary {
  total_predictions: number;
  defective_count: number;
  non_defective_count: number;
  defect_rate: number;
  average_confidence: number;
  prediction_rate_per_hour: number;
  distribution: Array<{ name: string; value: number }>;
  confidence_bands: Array<{ name: string; value: number }>;
  monthly_trends: Array<{ month: string; defective: number; non_defective: number; total: number }>;
  insights: string[];
  recommendations: string[];
}

export interface UserSetting {
  id: number;
  user_id: number;
  theme: "dark" | "light" | string;
  accent_color: string;
  notifications_enabled: boolean;
  voice_notifications: boolean;
  confidence_threshold: number;
  detection_sensitivity: number;
  camera_device?: string | null;
  language: string;
  dashboard_density: string;
  auto_save_detections: boolean;
  created_at: string;
  updated_at: string;
}
