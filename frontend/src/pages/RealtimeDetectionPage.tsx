import { useEffect, useRef, useState } from "react";
import { Download, Play, RefreshCw, Save, Square } from "lucide-react";

import { DetectionOverlay } from "../components/DetectionOverlay";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Panel } from "../components/ui/panel";
import { api } from "../lib/api";
import { percent, cn } from "../lib/utils";
import type { Detection, InferenceResponse } from "../types";

export function RealtimeDetectionPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const detectionIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [productType, setProductType] = useState("cars");
  const [isDetecting, setIsDetecting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [fps, setFps] = useState(0);
  const [lastResult, setLastResult] = useState<InferenceResponse | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [error, setError] = useState("");
  const [saveDetection, setSaveDetection] = useState(false);
  const [threshold, setThreshold] = useState(0.55);
  const [detectionMode, setDetectionMode] = useState<"object" | "quality">("object");

  const [videoDimensions, setVideoDimensions] = useState({
    width: 0,
    height: 0,
    naturalWidth: 0,
    naturalHeight: 0,
  });

  const updateDimensions = () => {
    const video = videoRef.current;
    if (video && video.videoWidth) {
      setVideoDimensions({
        width: video.clientWidth,
        height: video.clientHeight,
        naturalWidth: video.videoWidth,
        naturalHeight: video.videoHeight,
      });
    }
  };

  // Enumerate devices on mount
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then((available) => {
        setDevices(available.filter((device) => device.kind === "videoinput"));
      })
      .catch((err) => console.error("Enumerate devices error:", err));

    return () => {
      // Exit cleanup (using streamRef to avoid closure stale values)
      if (detectionIntervalRef.current !== null) {
        window.clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  const startCamera = async (id?: string) => {
    setError("");
    setDetections([]);
    setLastResult(null);
    
    // Stop any existing stream first
    stopCamera();

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          ...(id ? { deviceId: { exact: id } } : { facingMode: "user" }),
        },
        audio: false,
      });

      const video = videoRef.current;
      if (video) {
        // Setup direct playback properties
        video.muted = true;
        video.playsInline = true;
        video.srcObject = media;

        // Bind standard diagnostic logs
        video.onloadedmetadata = () => {
          console.log("[Camera Preview] loadedmetadata event triggered");
          console.log("[Camera Preview] Dimensions:", video.videoWidth, video.videoHeight);
          updateDimensions();
        };
        video.oncanplay = () => {
          console.log("[Camera Preview] canplay event triggered");
          updateDimensions();
        };
        video.onplaying = () => {
          console.log("[Camera Preview] playing event triggered (camera rendering)");
        };
        video.onerror = (e) => {
          console.error("[Camera Preview] video element error:", e);
        };

        // Await actual video playing event before setting active states
        await video.play();
        console.log("[Camera Preview] video.play() completed successfully");
      } else {
        throw new Error("Video element ref not bound");
      }

      // Only mark camera ON when stream is fully play-attached
      setStream(media);
      streamRef.current = media;
      
      const available = await navigator.mediaDevices.enumerateDevices();
      setDevices(available.filter((device) => device.kind === "videoinput"));
    } catch (err: any) {
      console.error("[Camera Preview] startCamera pipeline failed:", err);
      setError(err?.message || "Camera stream started but video playback failed.");
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (detectionIntervalRef.current !== null) {
      window.clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsDetecting(false);
    setDetections([]);
    setLastResult(null);
  };

  const startDetection = async () => {
    setError("");
    let activeStream = streamRef.current;
    if (!activeStream) {
      try {
        await startCamera(deviceId);
      } catch (err) {
        return;
      }
    }
    setIsDetecting(true);
  };

  const stopDetection = () => {
    if (detectionIntervalRef.current !== null) {
      window.clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    setIsDetecting(false);
    setDetections([]);
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.75);
  };

  const runInference = async () => {
    const imageData = captureFrame();
    if (!imageData) {
      return;
    }
    try {
      const response = await api.post<InferenceResponse>("/predictions/frame", {
        image_data: imageData,
        product_type: productType,
        confidence_threshold: threshold,
        save_detection: saveDetection,
      });
      
      setLastResult(response.data);
      setDetections(response.data.detections || []);
      
      if (response.data.object_detection_available === false) {
        setError("Object detection model unavailable. Defect classification active.");
      } else {
        setError("");
      }

      setFps(response.data.fps || 0);
      updateDimensions();
    } catch (err: any) {
      console.error("Inference error:", err);
    }
  };

  // Inference Loop Control
  useEffect(() => {
    if (!isDetecting || !stream) {
      if (detectionIntervalRef.current !== null) {
        window.clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      return;
    }

    if (detectionIntervalRef.current !== null) {
      window.clearInterval(detectionIntervalRef.current);
    }

    detectionIntervalRef.current = window.setInterval(() => {
      runInference().catch(() => undefined);
    }, 800);

    return () => {
      if (detectionIntervalRef.current !== null) {
        window.clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [isDetecting, stream, threshold, saveDetection]);

  const captureScreenshot = () => {
    const image = captureFrame();
    if (!image) return;
    const link = document.createElement("a");
    link.href = image;
    link.download = `inspection-${Date.now()}.jpg`;
    link.click();
  };

  const toggleRecording = () => {
    if (!stream) return;
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `inspection-replay-${Date.now()}.webm`;
      link.click();
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="border-cyan-300/30 bg-cyan-300/10 text-cyan-100">Real-time AI</Badge>
          <h1 className="mt-3 text-4xl font-semibold text-white">Live camera object & defect detection</h1>
          <p className="mt-2 text-zinc-400">Stream camera frames, display responsive SVG overlays, and monitor statistics.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={captureScreenshot} disabled={!stream}><Download className="h-4 w-4" />Capture</Button>
          <Button variant={recording ? "danger" : "secondary"} onClick={toggleRecording} disabled={!stream}>
            {recording ? <Square className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {recording ? "Stop rec" : "Record"}
          </Button>
        </div>
      </div>

      {error ? <div className="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
        <Panel className="overflow-hidden p-0 border border-white/10">
          <div className="relative aspect-video bg-black">
            <video
              ref={videoRef}
              className="relative h-full w-full object-cover block"
              style={{ opacity: 1, visibility: "visible", zIndex: 1 }}
              muted
              playsInline
            />
            <DetectionOverlay
              mode={detectionMode}
              detections={detections}
              videoDimensions={videoDimensions}
              predictionLabel={lastResult?.prediction_label}
              confidenceScore={lastResult?.confidence_score}
              reviewRequired={lastResult?.review_required}
              productDetectionWarning={lastResult?.product_detection_warning}
            />
            <div className="absolute left-4 top-4 flex flex-wrap gap-2">
              <Badge className="border-emerald-300/30 bg-emerald-400/10 text-emerald-100">FPS {fps}</Badge>
              <Badge>{lastResult?.source || "waiting"}</Badge>
              <Badge>{lastResult?.model_version || "model pending"}</Badge>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-5 border border-white/10">
            <h2 className="text-xl font-semibold text-white font-mono text-cyan-300">Inference Controls</h2>

            {/* Detection Mode Switcher */}
            <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-zinc-950 p-1 border border-white/5">
              <button
                type="button"
                onClick={() => setDetectionMode("object")}
                className={cn(
                  "rounded-md py-1.5 text-xs font-semibold transition-all duration-200",
                  detectionMode === "object"
                    ? "bg-cyan-500 text-zinc-950 shadow-md font-bold"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Object Detection
              </button>
              <button
                type="button"
                onClick={() => setDetectionMode("quality")}
                className={cn(
                  "rounded-md py-1.5 text-xs font-semibold transition-all duration-200",
                  detectionMode === "quality"
                    ? "bg-cyan-500 text-zinc-950 shadow-md font-bold"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Quality Inspection
              </button>
            </div>
            
            {/* Camera & Detection status text */}
            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs font-semibold">
              <div className={cn("rounded px-2 py-1.5 border", stream ? "bg-cyan-500/10 text-cyan-200 border-cyan-500/20" : "bg-zinc-800 text-zinc-500 border-zinc-700/50")}>
                Camera {stream ? "ON" : "OFF"}
              </div>
              <div className={cn("rounded px-2 py-1.5 border", isDetecting ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/20" : "bg-zinc-800 text-zinc-500 border-zinc-700/50")}>
                Detection {isDetecting ? "ON" : "OFF"}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={stream ? "secondary" : "primary"}
                  onClick={() => startCamera(deviceId)}
                  className={cn(!stream && "bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-semibold")}
                >
                  Start Camera
                </Button>
                <Button
                  variant="danger"
                  onClick={stopCamera}
                  disabled={!stream}
                  className={cn(stream && "bg-rose-600 hover:bg-rose-700 text-white")}
                >
                  Stop Camera
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={isDetecting ? "secondary" : "primary"}
                  onClick={startDetection}
                  className={cn(!isDetecting && "bg-cyan-500 hover:bg-cyan-600 text-zinc-950 font-semibold")}
                >
                  Start Detection
                </Button>
                <Button
                  variant="danger"
                  onClick={stopDetection}
                  disabled={!isDetecting}
                  className={cn(isDetecting && "bg-rose-600 hover:bg-rose-700 text-white")}
                >
                  Stop Detection
                </Button>
              </div>
            </div>

            <label className="mt-4 block text-sm text-zinc-400">
              Camera Input Device
              <select
                value={deviceId}
                onChange={(event) => {
                  setDeviceId(event.target.value);
                  if (stream) {
                    startCamera(event.target.value).catch(() => undefined);
                  }
                }}
                className="mt-2 h-10 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300/40"
              >
                <option value="" className="bg-zinc-950 text-white">Default camera</option>
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId} className="bg-zinc-950 text-white">{device.label || `Camera ${device.deviceId.slice(0, 5)}`}</option>
                ))}
              </select>
            </label>
            
            <label className="mt-4 block text-sm text-zinc-400">
              Target Product Pipeline
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300/40"
              >
                <option value="mobile">Mobile</option>
                <option value="cardboard_boxes">Cardboard Boxes</option>
                <option value="cars">Cars</option>
                <option value="plastic_bottles">Plastic Bottles</option>
                <option value="steel_surface">Steel Surface</option>
              </select>
            </label>

            <label className="mt-4 block text-sm text-zinc-400">
              Confidence threshold: {(threshold * 100).toFixed(0)}%
              <input className="mt-3 w-full accent-cyan-300" type="range" min="0.3" max="0.95" step="0.05" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
            </label>
            <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={saveDetection} onChange={(event) => setSaveDetection(event.target.checked)} />
              Auto-save camera inspections
            </label>
          </Panel>

          <Panel className="p-5 border border-white/10">
            <h2 className="text-xl font-semibold text-white font-mono text-cyan-300">Live Detection Results</h2>
            {lastResult ? (
              <div className="mt-4 space-y-4">
                {detectionMode === "object" ? (
                  /* Object Detection Results Panel */
                  <>
                    <div className="border-b border-white/10 pb-3">
                      <p className="text-xs uppercase tracking-wider text-zinc-500">Selected Mode</p>
                      <p className="mt-1 text-base font-bold text-white">YOLO Object Detection</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-b border-white/10 pb-3">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500">YOLO Model</p>
                        <p className="mt-1 text-sm font-semibold text-cyan-300 truncate">
                          {lastResult.object_model_version || "yolov8n"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500">Total Objects</p>
                        <p className="mt-1 text-sm font-semibold text-white">{detections.length}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-b border-white/10 pb-3">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500">YOLO Status</p>
                        <p className={cn(
                          "mt-1 text-xs font-semibold rounded-full px-2 py-0.5 inline-block text-center border",
                          lastResult.object_detection_available !== false
                            ? "bg-cyan-500/10 text-cyan-200 border-cyan-500/20"
                            : "bg-rose-500/10 text-rose-200 border-rose-500/20"
                        )}>
                          {lastResult.object_detection_available !== false ? "YOLO Active" : "YOLO Missing"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500">Latency / FPS</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-300">
                          {fps} FPS ({lastResult.processing_ms || 0}ms)
                        </p>
                      </div>
                    </div>

                    {detections.length > 0 ? (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Detected Objects</p>
                        <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                          {detections.map((det, i) => (
                            <div key={i} className="flex justify-between items-center bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs text-zinc-300">
                              <span className="font-semibold text-white capitalize">{det.label}</span>
                              <span className="text-cyan-300 font-mono">{(det.confidence * 100).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 italic">No objects currently in frame.</p>
                    )}
                  </>
                ) : (
                  /* Product Quality Inspection Results Panel */
                  <>
                    <div className="border-b border-white/10 pb-3">
                      <p className="text-xs uppercase tracking-wider text-zinc-500">Selected Mode</p>
                      <p className="mt-1 text-base font-bold text-white">Product Quality Detection</p>
                    </div>

                    <div className="border-b border-white/10 pb-3">
                      <p className="text-xs uppercase tracking-wider text-zinc-500">Inspection Status</p>
                      <p className={cn(
                        "mt-1.5 text-2xl font-bold uppercase tracking-wide",
                        lastResult.prediction_label === "defective"
                          ? "text-rose-400 font-mono"
                          : "text-emerald-400 font-mono"
                      )}>
                        {lastResult.prediction_label === "defective" ? "Defective Product" : "Non-Defective / Pass"}
                      </p>
                      {lastResult.review_required && (
                        <p className="mt-1 inline-block rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
                          ⚠ Needs Review — confidence below threshold
                        </p>
                      )}
                      {lastResult.model_uncertain && (
                        <p className="mt-1.5 block rounded border border-orange-400/30 bg-orange-500/10 px-2 py-1 text-xs font-semibold text-orange-300">
                          ⚠ Model uncertain — this product type may be unsupported
                        </p>
                      )}
                      {lastResult.product_detection_warning && (
                        <p className="mt-1.5 block rounded border border-yellow-400/30 bg-yellow-500/10 px-2 py-1 text-xs font-semibold text-yellow-300">
                          {lastResult.product_detection_warning}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-b border-white/10 pb-3">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500">Defect Confidence</p>
                        <p className="mt-1 text-lg font-bold text-white">{percent(lastResult.confidence_score, 1)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500">Inference Speed</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-300">
                          {fps} FPS ({lastResult.processing_ms || 0}ms)
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-b border-white/10 pb-3">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500">Classifier Model</p>
                        <p className="mt-1 text-xs font-semibold text-zinc-300 truncate">
                          {lastResult.model_version && lastResult.model_version !== "yolov8n"
                            ? lastResult.model_version
                            : "defect_model"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500">Data Source</p>
                        <p className="mt-1 text-xs font-semibold text-zinc-300 truncate">
                          {lastResult.source || "TF Core"}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <div className="pt-2 text-[10px] text-zinc-600 font-mono flex justify-between">
                  <span>Pipeline: {lastResult.source}</span>
                  <span>Timestamp: {new Date(lastResult.timestamp || Date.now()).toLocaleTimeString()}</span>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">Waiting for live video feed.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
