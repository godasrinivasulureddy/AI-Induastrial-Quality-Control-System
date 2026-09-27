import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, FileVideo, Image, UploadCloud, Camera, X } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Panel } from "../components/ui/panel";
import { api } from "../lib/api";
import { percent } from "../lib/utils";
import type { ClassifyResponse, InferenceResponse, Prediction } from "../types";

interface PendingUpload {
  id: string;
  file: File;
}

interface UploadResult {
  id: string;
  name: string;
  result: Prediction | InferenceResponse;
}

export function UploadDetectionPage() {
  const [productType, setProductType] = useState("mobile");
  const [files, setFiles] = useState<PendingUpload[]>([]);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState("");
  const inFlight = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    inFlight.current?.abort();
    inFlight.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  }, []);

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      setError("Could not access the camera. Please check permissions.");
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
            setFiles((prev) => [...prev, { id: crypto.randomUUID(), file }]);
            closeCamera();
          }
        }, "image/jpeg");
      }
    }
  };

  const changeProduct = (product: string) => {
    if (inFlight.current) return;
    setProductType(product);
    setFiles([]);
    setResults([]);
    setJobId("");
    setProgress(0);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const addFiles = (list: FileList | File[]) => {
    if (inFlight.current || !list.length) return;
    const added = Array.from(list, (file) => ({ id: crypto.randomUUID(), file }));
    setFiles((current) => [...current, ...added]);
    setResults([]);
    setJobId("");
    setProgress(0);
    setError("");
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  };

  const runBatch = async () => {
    if (inFlight.current || !files.length) return;
    const controller = new AbortController();
    inFlight.current = controller;
    const job = { id: crypto.randomUUID(), product: productType, files: [...files] };
    let modelVersion: string | undefined;
    setJobId(job.id);
    setRunning(true);
    setResults([]);
    setError("");
    setProgress(0);
    const completed: UploadResult[] = [];
    try {
      for (let index = 0; index < job.files.length; index += 1) {
        if (controller.signal.aborted) return;
        const pending = job.files[index];
        const file = pending.file;
        const formData = new FormData();
        formData.append("file", file);
        const isVideo = file.type.startsWith("video/");
        const endpoint = isVideo ? "/predictions/video" : "/predictions/classify";
        if (!isVideo) {
          formData.append("product_type", job.product);
          formData.append("job_id", job.id);
          if (modelVersion) formData.append("expected_model_version", modelVersion);
        }

        const response = await api.post(endpoint, formData, {
          signal: controller.signal,
          onUploadProgress: (event) => {
            if (!event.total || controller.signal.aborted) return;
            const local = Math.round((event.loaded / event.total) * 100);
            setProgress(Math.round(((index + local / 100) / job.files.length) * 100));
          },
        });
        if (controller.signal.aborted) return;

        let resultData = response.data;
        if (!isVideo) {
          const data = response.data as ClassifyResponse;
          if (data.job_id !== job.id || data.product !== job.product || !data.model_version ||
              (modelVersion && data.model_version !== modelVersion)) {
            throw new Error("Prediction response does not match the current job/model. Check the API version before retrying.");
          }
          modelVersion = data.model_version;
          resultData = {
            id: data.prediction_id,
            image_path: data.image_path,
            timestamp: data.timestamp,
            prediction_label: data.predicted_class,
            confidence_score: data.confidence,
            model_version: data.model_version,
            source: data.product,
            model_uncertain: data.model_uncertain,
            review_required: data.review_required,
            detections: [],
          };
        }

        // Only this acknowledged input leaves the queue. Failures and unattempted files remain.
        setFiles((current) => current.filter((item) => item.id !== pending.id));
        completed.push({ id: pending.id, name: file.name, result: resultData });
        setResults([...completed]);
      }
      setProgress(100);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      const detail = err.response?.data?.detail;
      const message = typeof detail === "string" 
        ? detail 
        : Array.isArray(detail) 
          ? detail.map((d: any) => d.msg).join(", ") 
          : err.message || "Upload prediction failed.";
      setError(message);
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        setRunning(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge>Upload AI</Badge>
        <h1 className="mt-3 text-4xl font-semibold text-white">Upload detection system</h1>
        <p className="mt-2 text-zinc-400">Multi-image, video upload, batch prediction, progress tracking, and result cards.</p>
      </div>

      {error ? <div className="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}

      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-white">Select Product Type:</label>
        <select 
          value={productType}
          disabled={running}
          onChange={(e) => changeProduct(e.target.value)}
          className="rounded-md border border-white/20 bg-black/50 px-3 py-1.5 text-sm text-white"
        >
          <option value="mobile">Mobile</option>
          <option value="cardboard_boxes">Cardboard Boxes</option>
          <option value="cars">Cars</option>
          <option value="plastic_bottles">Plastic Bottles</option>
          <option value="steel_surface">Steel Surface</option>
        </select>
      </div>
      <p className="text-sm text-zinc-500">Changing product clears pending files. Completed predictions remain in History.</p>

      <Panel
        className="border-dashed p-8 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        {isCameraActive ? (
          <div className="flex flex-col items-center">
            <video ref={videoRef} autoPlay playsInline className="h-[400px] w-full max-w-[600px] rounded-md object-cover bg-black" />
            <div className="mt-5 flex items-center justify-center gap-4">
              <Button onClick={captureImage}><Camera className="mr-2 h-4 w-4" /> Capture Photo</Button>
              <Button variant="secondary" onClick={closeCamera}><X className="mr-2 h-4 w-4" /> Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            <UploadCloud className="mx-auto h-10 w-10 text-cyan-200" />
            <h2 className="mt-4 text-xl font-semibold text-white">Drop product media here</h2>
            <p className="mt-2 text-sm text-zinc-500">Images are persisted to prediction history. Videos return frame-level inference summary.</p>
            <input ref={inputRef} id="upload-input" type="file" multiple accept="image/*,video/*" className="hidden" disabled={running} onChange={handleChange} />
            <div className="mt-5 flex justify-center gap-3">
              <Button disabled={running} onClick={() => inputRef.current?.click()}>Browse files</Button>
              <Button variant="secondary" disabled={running} onClick={openCamera}><Camera className="mr-2 h-4 w-4" /> Open Camera</Button>
            </div>
          </>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Batch queue</h2>
            <Button disabled={!files.length || running} onClick={runBatch}><CheckCircle2 className="h-4 w-4" />Run AI</Button>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-4 space-y-2">
            {files.map(({ id, file }) => (
              <div key={id} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/5 p-3 text-sm">
                {file.type.startsWith("video/") ? <FileVideo className="h-4 w-4 text-amber-200" /> : <Image className="h-4 w-4 text-cyan-200" />}
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="text-xs text-zinc-500">{Math.round(file.size / 1024)} KB</span>
              </div>
            ))}
            {!files.length ? <p className="text-sm text-zinc-500">No pending files.</p> : null}
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="text-xl font-semibold text-white">Prediction result cards</h2>
          {jobId ? <p className="mt-1 text-xs text-zinc-500">Job {jobId} · {running ? "Running" : error ? "Incomplete — retry pending files" : "Completed"}</p> : null}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {results.map((item) => {
              const r = item.result as InferenceResponse;
              const isUncertain = r.model_uncertain;
              const isDefective = r.prediction_label === "defective";
              return (
                <div
                  key={item.id}
                  className={`rounded-md border p-4 ${
                    isUncertain
                      ? "border-orange-400/30 bg-orange-500/5"
                      : isDefective
                      ? "border-rose-400/30 bg-rose-500/5"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                  <p className={`mt-3 text-2xl font-semibold ${
                    isUncertain ? "text-orange-300" : isDefective ? "text-rose-400" : "text-emerald-400"
                  }`}>
                    {isUncertain ? "Uncertain" : r.prediction_label}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">Confidence {percent(r.confidence_score, 2)}</p>
                  <p className="mt-1 break-all text-xs text-zinc-500" title={r.model_version}>Product: {r.source || "ai"} / Model: {r.model_version?.replace(/(sha256:)([a-f0-9]{12})[a-f0-9]+/, "$1$2") || "model"}</p>
                  {r.timestamp ? <p className="mt-1 text-xs text-zinc-500">{r.timestamp}</p> : null}
                  {isUncertain && (
                    <p className="mt-2 rounded border border-orange-400/30 bg-orange-500/10 px-2 py-1 text-xs font-semibold text-orange-300">
                      ⚠ Low-confidence prediction — review this image
                    </p>
                  )}
                  {r.review_required && !isUncertain && (
                    <p className="mt-2 rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs font-semibold text-amber-300">
                      ⚠ Needs Review — confidence below threshold
                    </p>
                  )}
                </div>
              );
            })}
            {!results.length ? <p className="text-sm text-zinc-500">Results appear after prediction.</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
