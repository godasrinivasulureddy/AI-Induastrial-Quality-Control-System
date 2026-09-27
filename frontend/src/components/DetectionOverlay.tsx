import type { Detection } from "../types";

export type DetectionMode = "object" | "quality";

export interface VideoDimensions {
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
}

export interface DetectionOverlayProps {
  mode: DetectionMode;
  detections: Detection[];
  videoDimensions: VideoDimensions;
  predictionLabel?: string;
  confidenceScore?: number;
  reviewRequired?: boolean;
  productDetectionWarning?: string | null;
}

// Product-like YOLO class names that are valid inspection subjects.
// Must stay in sync with PRODUCT_CLASSES in ai_service.py.
const PRODUCT_CLASSES = new Set([
  "cell phone", "laptop", "keyboard", "mouse", "remote",
  "bottle", "cup", "wine glass", "bowl",
  "book", "vase", "scissors", "toothbrush",
  "tv", "monitor", "clock",
  "car", "truck", "bus", "bicycle", "motorcycle",
  "suitcase", "backpack", "handbag", "umbrella",
  "chair", "couch", "bed", "dining table",
  "microwave", "oven", "toaster", "refrigerator", "sink",
  "airplane", "boat",
  "object", "product", "defect",
]);

export function DetectionOverlay({
  mode,
  detections,
  videoDimensions,
  predictionLabel,
  confidenceScore,
  reviewRequired,
  productDetectionWarning,
}: DetectionOverlayProps) {
  const { width, height, naturalWidth, naturalHeight } = videoDimensions;
  if (!naturalWidth || !naturalHeight || !width || !height) return null;

  const scaleX = width / naturalWidth;
  const scaleY = height / naturalHeight;

  // Setup colors and styles for Quality mode
  const isDefective = predictionLabel === "defective";
  const hasResult = predictionLabel === "defective" || predictionLabel === "non-defective";
  const strokeColor = isDefective ? "#f43f5e" : "#10b981"; // Vibrant rose-500 or emerald-500
  const shadowColor = isDefective ? "rgba(244, 63, 94, 0.5)" : "rgba(16, 185, 129, 0.5)";

  // Quality badge label: append REVIEW indicator when model confidence is below threshold
  const qualityConfText = `${((confidenceScore || 0) * 100).toFixed(0)}%${reviewRequired ? " ⚠ REVIEW" : ""}`;
  const frameLabel = isDefective ? `DEFECTIVE ${qualityConfText}` : `NON-DEFECTIVE ${qualityConfText}`;
  const boxLabel = isDefective ? `DEFECTIVE ${qualityConfText}` : `NON-DEF ${qualityConfText}`;

  const badgeWidth = reviewRequired ? 240 : 200;
  const badgeX = (width - badgeWidth) / 2;

  // In quality mode: only count product-like boxes (exclude person, tie, etc.)
  const productBoxes = detections.filter(d => PRODUCT_CLASSES.has(d.label.toLowerCase()));
  const qualityHasBoxes = mode === "quality" && productBoxes.length > 0 && hasResult;
  // When YOLO ran but only non-product objects (e.g. person) were found
  const productMissing = mode === "quality" && !qualityHasBoxes && !!productDetectionWarning;

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full z-10">
      {mode === "object" ? (
        detections.map((detection, index) => {
          let displayedX = 0;
          let displayedY = 0;
          let displayedW = 0;
          let displayedH = 0;

          if (detection.bbox) {
            const [x1, y1, x2, y2] = detection.bbox;
            displayedX = x1 * scaleX;
            displayedY = y1 * scaleY;
            displayedW = (x2 - x1) * scaleX;
            displayedH = (y2 - y1) * scaleY;
          } else if (detection.box) {
            // Fallback to old normalized box scaling if absolute bbox is missing
            displayedX = detection.box.x * width;
            displayedY = detection.box.y * height;
            displayedW = detection.box.width * width;
            displayedH = detection.box.height * height;
          } else {
            return null;
          }

          const confidence = (detection.confidence * 100).toFixed(0);
          const itemLabelText = `${detection.label} ${confidence}%`;
          const labelWidth = Math.max(60, itemLabelText.length * 7 + 10);

          return (
            <g key={`${detection.label}-${index}`}>
              {/* Bounding box */}
              <rect
                x={displayedX}
                y={displayedY}
                width={displayedW}
                height={displayedH}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2"
                style={{
                  filter: "drop-shadow(0 0 6px rgba(6, 182, 212, 0.4))",
                }}
              />
              
              {/* Label background */}
              <rect
                x={displayedX}
                y={displayedY > 18 ? displayedY - 18 : displayedY}
                width={labelWidth}
                height="18"
                fill="#06b6d4"
                rx="2"
              />
              
              {/* Label text */}
              <text
                x={displayedX + 4}
                y={displayedY > 18 ? displayedY - 18 : displayedY}
                dy="13"
                fill="#ffffff"
                fontSize="10"
                fontWeight="bold"
                className="font-mono"
              >
                {itemLabelText}
              </text>
            </g>
          );
        })
      ) : qualityHasBoxes ? (
        /* Quality mode with product YOLO boxes: attach quality label to each product box.
           person / human boxes are intentionally skipped. */
        productBoxes.map((detection, index) => {
          let displayedX = 0;
          let displayedY = 0;
          let displayedW = 0;
          let displayedH = 0;

          if (detection.bbox) {
            const [x1, y1, x2, y2] = detection.bbox;
            displayedX = x1 * scaleX;
            displayedY = y1 * scaleY;
            displayedW = (x2 - x1) * scaleX;
            displayedH = (y2 - y1) * scaleY;
          } else if (detection.box) {
            displayedX = detection.box.x * width;
            displayedY = detection.box.y * height;
            displayedW = detection.box.width * width;
            displayedH = detection.box.height * height;
          } else {
            return null;
          }

          // Quality label per box — do NOT show YOLO object class name
          const qLabelWidth = Math.max(80, boxLabel.length * 7 + 12);

          return (
            <g key={`quality-box-${index}`}>
              {/* Quality-colored bounding box */}
              <rect
                x={displayedX}
                y={displayedY}
                width={displayedW}
                height={displayedH}
                fill="none"
                stroke={strokeColor}
                strokeWidth="3"
                style={{
                  filter: `drop-shadow(0 0 8px ${shadowColor})`,
                }}
              />

              {/* Quality label background */}
              <rect
                x={displayedX}
                y={displayedY > 22 ? displayedY - 22 : displayedY}
                width={qLabelWidth}
                height="20"
                fill={strokeColor}
                rx="3"
                style={{
                  filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))",
                }}
              />

              {/* Quality label text (DEFECTIVE / NON-DEF + confidence) */}
              <text
                x={displayedX + 5}
                y={displayedY > 22 ? displayedY - 22 : displayedY}
                dy="14"
                fill="#ffffff"
                fontSize="10"
                fontWeight="bold"
                className="font-mono"
              >
                {boxLabel}
              </text>
            </g>
          );
        })
      ) : (
        /* Quality mode fallback: full-frame border + centered badge (no product boxes) */
        hasResult && (
          <g>
            {/* Full-frame quality border */}
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="none"
              stroke={strokeColor}
              strokeWidth="6"
              style={{
                filter: `drop-shadow(0 0 10px ${shadowColor})`,
              }}
            />

            {/* Centered Quality Badge */}
            <g>
              <rect
                x={badgeX}
                y="16"
                width={badgeWidth}
                height="28"
                fill={strokeColor}
                rx="6"
                style={{
                  filter: "drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35))",
                }}
              />
              <text
                x={badgeX + badgeWidth / 2}
                y="16"
                dy="19"
                fill="#ffffff"
                fontSize="12"
                fontWeight="bold"
                textAnchor="middle"
                className="font-mono"
              >
                {frameLabel}
              </text>
            </g>

            {/* "Product not detected" warning badge when person-only or empty detection */}
            {productMissing && (
              <g>
                <rect
                  x={(width - 290) / 2}
                  y="52"
                  width="290"
                  height="22"
                  fill="#b45309"
                  rx="4"
                  opacity="0.92"
                />
                <text
                  x={width / 2}
                  y="52"
                  dy="15"
                  fill="#fef3c7"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  className="font-mono"
                >
                  {productDetectionWarning}
                </text>
              </g>
            )}
          </g>
        )
      )}
    </svg>
  );
}
