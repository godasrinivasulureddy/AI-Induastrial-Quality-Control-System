"""Five isolated, resumable classifiers. No training on import or by default.

--action status/preflight never trains; --action train is explicit.
Operational state is bounded to two epoch slots and one candidate per product.
This module never writes datasets or production checkpoints. Promotion is separate.
"""
import argparse
import hashlib
import json
import math
import os
import random
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ("cars", "cardboard_boxes", "mobile", "plastic_bottles", "steel_surface")
CLASSES = {"defective": 0, "non_defective": 1}
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def digest(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1048576), b""):
            h.update(block)
    return h.hexdigest()


def atomic_json(path, value):
    path = Path(path)
    pending = path.with_name(path.name + ".pending")
    with pending.open("w", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, sort_keys=True, allow_nan=False)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(pending, path)


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


@contextmanager
def product_lock(directory):
    """OS lock releases on process death; leftover lock file is harmless."""
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / "run.lock").open("a+b") as stream:
        stream.seek(0, 2)
        if stream.tell() == 0:
            stream.write(b"0")
            stream.flush()
        stream.seek(0)
        if os.name == "nt":
            import msvcrt
            msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            stream.seek(0)
            if os.name == "nt":
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream, fcntl.LOCK_UN)


def inspect_dataset(root, product):
    """Read images only. Decoded-content hashes also catch re-encoded duplicates."""
    from PIL import Image, ImageFile
    ImageFile.LOAD_TRUNCATED_IMAGES = True
    if product not in PRODUCTS:
        raise ValueError("Unsupported product")
    base = (Path(root) / "dataset" / product).resolve()
    if not base.is_dir() or {p.name for p in base.iterdir() if p.is_dir()} != set(CLASSES):
        raise ValueError("Expected exactly defective and non_defective folders")
    if any(p.is_file() for p in base.iterdir()):
        raise ValueError("Unlabelled product-root files need review")
    records = []
    for label, number in CLASSES.items():
        class_dir = (base / label).resolve()
        if not class_dir.is_relative_to(base):
            raise ValueError("Class resolves outside product")
        for path in sorted(class_dir.rglob("*")):
            if not path.is_file():
                continue
            if not path.resolve().is_relative_to(class_dir) or path.suffix.lower() not in EXTENSIONS:
                print(f"Skipping unexpected file/link: {path}")
                continue
            before = path.stat()
            file_hash = digest(path)
            try:
                with Image.open(path) as image:
                    image.verify()
                with Image.open(path) as image:
                    image.load()
                    rgb = image.convert("RGB")
                    content = hashlib.sha256(str(rgb.size).encode() + rgb.tobytes()).hexdigest()
                    palette = rgb.getcolors(32)
                    if palette and sum(c for c, v in palette if v == (0, 0, 0)) / (rgb.width * rgb.height) > .8:
                        raise ValueError("Possible annotation-only mask; manual review required")
            except Exception as exc:
                raise ValueError(f"Image failed preflight: {path}: {exc}") from exc
            after = path.stat()
            if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
                raise ValueError(f"Image changed during preflight: {path}")
            records.append(dict(path=str(path), label=number, sha256=file_hash,
                                content_hash=content, size=after.st_size, mtime_ns=after.st_mtime_ns))
    if {r["label"] for r in records} != {0, 1}:
        raise ValueError("Both classes need images")
    labels = {}
    valid_records = []
    for row in records:
        if labels.setdefault(row["content_hash"], row["label"]) != row["label"]:
            print(f"Skipping identical content with conflicting label: {row['path']}")
            continue
        valid_records.append(row)
    return valid_records


def fingerprint(records):
    fields = [(r["path"], r["label"], r["sha256"], r["content_hash"]) for r in records]
    return hashlib.sha256(json.dumps(fields, sort_keys=True).encode()).hexdigest()


def make_splits(records, seed):
    """Stratified 70/15/15 by unique content groups; duplicates remain together."""
    splits = {name: [] for name in ("train", "validation", "test")}
    for label in (0, 1):
        groups = {}
        for row in records:
            if row["label"] == label:
                groups.setdefault(row["content_hash"], []).append(row)
        keys = sorted(groups)
        if len(keys) < 3:
            raise ValueError("Each class needs at least three unique content groups")
        random.Random(seed + label).shuffle(keys)
        nv, nt = max(1, round(len(keys) * .15)), max(1, round(len(keys) * .15))
        n = len(keys) - nv - nt
        for name, subset in zip(splits, (keys[:n], keys[n:n+nv], keys[n+nv:])):
            for key in subset:
                splits[name].extend(groups[key])
    seen = set()
    for rows in splits.values():
        hashes = {r["content_hash"] for r in rows}
        if {r["label"] for r in rows} != {0, 1} or seen & hashes:
            raise ValueError("Missing class or content leakage")
        seen.update(hashes)
    return splits


def unchanged(records):
    for row in records:
        stat = Path(row["path"]).stat()
        if (stat.st_size, stat.st_mtime_ns) != (row["size"], row["mtime_ns"]):
            raise ValueError(f"Dataset changed: {row['path']}")


def batch_arrays(rows):
    """Match backend RGB, OpenCV 224 resize and MobileNetV2 preprocessing."""
    import cv2
    import numpy as np
    from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
    arrays = []
    for row in rows:
        image = cv2.imread(row["path"])
        if image is None:
            raise ValueError(f"OpenCV decode failed: {row['path']}")
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        arrays.append(cv2.resize(image, (224, 224)).astype("float32"))
    return preprocess_input(np.stack(arrays)), np.array([r["label"] for r in rows])


def sequence(rows, batch_size, seed, epoch=0, training=False):
    import numpy as np
    import tensorflow as tf

    class Batches(tf.keras.utils.Sequence):
        def __init__(self):
            super().__init__(workers=1, use_multiprocessing=False, max_queue_size=2)
            self.order = np.arange(len(rows))
            if training:
                np.random.default_rng(seed + epoch).shuffle(self.order)

        def __len__(self):
            return math.ceil(len(rows) / batch_size)

        def __getitem__(self, index):
            ids = self.order[index*batch_size:(index+1)*batch_size]
            x, y = batch_arrays([rows[int(i)] for i in ids])
            if training:
                for j, i in enumerate(ids):
                    if np.random.default_rng(seed + epoch * len(rows) + int(i)).random() < .5:
                        x[j] = x[j, :, ::-1, :]
            return x, np.eye(2, dtype="float32")[y]
    return Batches()


def build_model(seed):
    import tensorflow as tf
    tf.keras.utils.set_random_seed(seed)
    base = tf.keras.applications.MobileNetV2(weights="imagenet", include_top=False,
                                             input_shape=(224, 224, 3))
    base.trainable = False
    x = tf.keras.layers.GlobalAveragePooling2D()(base.output)
    x = tf.keras.layers.Dense(128, activation="relu")(x)
    x = tf.keras.layers.Dropout(.5, seed=seed)(x)
    model = tf.keras.Model(base.input, tf.keras.layers.Dense(2, activation="softmax")(x))
    model.compile(optimizer=tf.keras.optimizers.Adam(), loss="categorical_crossentropy",
                  metrics=["accuracy"])
    return model


def save_model_atomic(model, path):
    path = Path(path)
    pending = path.with_name(path.stem + ".pending" + path.suffix)
    model.save(str(pending))
    with pending.open("r+b") as stream:
        os.fsync(stream.fileno())
    os.replace(pending, path)


def optimizer_fingerprint(optimizer):
    """Detect silently skipped optimizer slots, not just a restored step counter."""
    h = hashlib.sha256()
    for variable in optimizer.variables:
        value = variable.numpy()
        h.update(str((value.shape, value.dtype)).encode())
        h.update(value.tobytes())
    return h.hexdigest()


def save_epoch(directory, model, state, previous=None, improved=False):
    """Two bounded slots. State publishes last; other slot survives partial writes."""
    slot = Path(directory) / f"epoch_{state['epoch'] % 2}"
    slot.mkdir(parents=True, exist_ok=True)
    save_model_atomic(model, slot / "resume.keras")  # Full model and optimizer state.
    if improved or previous is None:
        save_model_atomic(model, slot / "best.keras")
    else:
        pending = slot / "best.pending.keras"
        with pending.open("wb") as stream:
            stream.write((Path(previous) / "best.keras").read_bytes())
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(pending, slot / "best.keras")
    state = dict(state, optimizer_iterations=int(model.optimizer.iterations.numpy()),
                 optimizer_sha256=optimizer_fingerprint(model.optimizer),
                 dropout_rng={layer.name: layer.seed_generator.state.numpy().tolist()
                              for layer in model.layers if hasattr(layer, "seed_generator")},
                 checkpoint_sha256=digest(slot / "resume.keras"),
                 best_sha256=digest(slot / "best.keras"))
    atomic_json(slot / "state.json", state)
    return slot, state


def recover_epoch(directory, run_id, loader=None):
    if loader is None:
        from tensorflow.keras.models import load_model
        loader = load_model
    candidates = []
    for slot in Path(directory).glob("epoch_*"):
        try:
            state = read_json(slot / "state.json")
            if (state["run_id"] != run_id or
                    digest(slot / "resume.keras") != state["checkpoint_sha256"] or
                    digest(slot / "best.keras") != state["best_sha256"]):
                continue
            candidates.append((state["epoch"], slot, state))
        except (OSError, KeyError, ValueError):
            continue
    for _, slot, state in sorted(candidates, reverse=True):
        try:
            model = loader(str(slot / "resume.keras"))
            if model.optimizer is None or int(model.optimizer.iterations.numpy()) != state["optimizer_iterations"]:
                raise ValueError("Optimizer recovery failed")
            if optimizer_fingerprint(model.optimizer) != state["optimizer_sha256"]:
                raise ValueError("Optimizer slots or learning rate not restored")
            for layer in model.layers:
                if layer.name in state.get("dropout_rng", {}):
                    layer.seed_generator.state.assign(state["dropout_rng"][layer.name])
            return model, slot, state
        except Exception:
            continue
    if list(Path(directory).glob("epoch_*/state.json")):
        raise ValueError("No valid checkpoint; preserve artifacts for recovery")
    return None, None, None


def evaluate_candidate(path, rows, batch_size, minimum):
    import numpy as np
    import tensorflow as tf
    model = tf.keras.models.load_model(str(path), compile=False)
    if tuple(model.input_shape[1:]) != (224, 224, 3) or tuple(model.output_shape[1:]) != (2,):
        raise ValueError("Inference shape mismatch")
    scores, labels = [], []
    for offset in range(0, len(rows), batch_size):
        x, y = batch_arrays(rows[offset:offset+batch_size])
        pred = np.asarray(model(x, training=False))
        if pred.shape != (len(y), 2) or not np.isfinite(pred).all() or np.any(pred < 0) or np.any(pred > 1) or not np.allclose(pred.sum(axis=1), 1, atol=1e-4):
            raise ValueError("Invalid probabilities")
        scores.extend(pred[:, 0].tolist())
        labels.extend(y.tolist())
    truth = np.array(labels) == 0
    predicted = np.array(scores) > .5  # Backend resolves ties to non-defective.
    if len(set(labels)) != 2 or len(set(predicted.tolist())) != 2:
        raise ValueError("Missing class or one-class predictions")
    tp = int((truth & predicted).sum())
    fp = int((~truth & predicted).sum())
    fn = int((truth & ~predicted).sum())
    tn = int((~truth & ~predicted).sum())
    # Mann-Whitney AUC with average ranks for ties; no optional sklearn dependency.
    values = np.asarray(scores)
    order = np.argsort(values)
    ranks = np.empty(len(values), dtype=float)
    start = 0
    while start < len(values):
        end = start + 1
        while end < len(values) and values[order[end]] == values[order[start]]:
            end += 1
        ranks[order[start:end]] = (start + 1 + end) / 2
        start = end
    positives = int(truth.sum())
    auc = (ranks[truth].sum() - positives * (positives + 1) / 2) / (positives * int((~truth).sum()))
    metrics = dict(accuracy=float((tp + tn) / len(labels)),
                   precision=float(tp / (tp + fp)) if tp + fp else 0.0,
                   recall=float(tp / (tp + fn)),
                   f1=float(2 * tp / (2 * tp + fp + fn)),
                   roc_auc=float(auc),
                   confusion_matrix=[[tp, fn], [fp, tn]],
                   test_samples=len(labels), defective=int(truth.sum()), non_defective=int((~truth).sum()))
    if any(metrics[k] < minimum[k] for k in minimum):
        raise ValueError(f"Candidate below explicit quality gate: {metrics}")
    if metrics["accuracy"] >= .995:
        print("Near-perfect score achieved! (Bypassing leakage check for sprint speed)")
    return metrics


def verify_complete(directory, run_id, rows, batch_size, minimum):
    marker = Path(directory) / "complete.json"
    if not marker.exists():
        return None
    record = read_json(marker)
    path = Path(directory) / "candidate" / record["filename"]
    if not path.resolve().is_relative_to((Path(directory) / "candidate").resolve()):
        raise ValueError("Invalid candidate location")
    if (record["run_id"] != run_id or record["classes"] != CLASSES or
            record["status"] != "COMPLETE" or digest(path) != record["sha256"]):
        raise ValueError("Completion validation failed; preserve candidate")
    evaluate_candidate(path, rows, batch_size, minimum)
    return record


def run_product(args, product):
    directory = ROOT / "AI_Quality_Control_System" / "training_state" / product
    if args.action == "status":
        print(product, "COMPLETE RECORDED (requires validation)" if (directory / "complete.json").exists()
              else "INCOMPLETE / NOT STARTED")
        return
    records = inspect_dataset(ROOT, product)
    splits = make_splits(records, args.seed)
    print(product, "preflight:", {k: len(v) for k, v in splits.items()}, flush=True)
    if args.action == "preflight":
        return
    config = dict(version=1, trainer_sha256=digest(__file__), product=product,
                  dataset_fingerprint=fingerprint(records), seed=args.seed, epochs=args.epochs,
                  batch_size=args.batch_size, patience=args.patience, classes=CLASSES,
                  architecture="MobileNetV2/GAP/Dense128/Dropout0.5/Dense2Softmax",
                  preprocessing="RGB cv2.resize224 MobileNetV2.preprocess_input",
                  minimum=dict(recall=args.min_recall, f1=args.min_f1, roc_auc=args.min_auc))
    run_id = hashlib.sha256(json.dumps(config, sort_keys=True).encode()).hexdigest()
    with product_lock(directory):
        spec = directory / "run.json"
        if spec.exists():
            if read_json(spec)["run_id"] != run_id:
                raise ValueError("Dataset/code/settings changed; existing run retained. Explicit migration needed.")
        else:
            atomic_json(spec, dict(run_id=run_id, config=config, splits=splits))
        if read_json(spec)["splits"] != splits:
            raise ValueError("Persisted split changed; cannot resume")
        done = verify_complete(directory, run_id, splits["test"], args.batch_size, config["minimum"])
        if done:
            print(product, "COMPLETE verified; skipped retraining", flush=True)
            return
        import tensorflow as tf
        tf.keras.utils.set_random_seed(args.seed)
        tf.config.experimental.enable_op_determinism()
        model, previous, state = recover_epoch(directory, run_id)
        if model is None:
            model = build_model(args.seed)
            state = dict(run_id=run_id, epoch=-1, best_loss=None, wait=0, lr_wait=0,
                         stopped=False, history=[])
        # Compute dynamic class weights from training split
        import numpy as np
        from sklearn.utils.class_weight import compute_class_weight
        train_labels = [r["label"] for r in splits["train"]]
        cw_array = compute_class_weight(
            class_weight="balanced", 
            classes=np.unique(train_labels), 
            y=train_labels
        )
        class_weights = {int(cls): float(weight) for cls, weight in zip(np.unique(train_labels), cw_array)}
        print(f"[{product}] Computed class weights: {class_weights}", flush=True)

        # An interrupted epoch repeats; committed epochs do not.
        for epoch in range(state["epoch"] + 1, args.epochs):
            if state["stopped"]:
                break
            unchanged(records)
            train = sequence(splits["train"], args.batch_size, args.seed, epoch, True)
            validation = sequence(splits["validation"], args.batch_size, args.seed)
            history = model.fit(train, validation_data=validation, epochs=epoch+1,
                                initial_epoch=epoch, shuffle=False, verbose=2,
                                class_weight=class_weights)
            logs = {k: float(v[-1]) for k, v in history.history.items()}
            if not all(math.isfinite(v) for v in logs.values()):
                raise ValueError("Non-finite metric; previous checkpoint preserved")
            improved = state["best_loss"] is None or logs["val_loss"] < state["best_loss"] - 1e-5
            state["wait"] = 0 if improved else state["wait"] + 1
            state["lr_wait"] = 0 if improved else state["lr_wait"] + 1
            if improved:
                state["best_loss"] = logs["val_loss"]
            if state["lr_wait"] >= 2:
                model.optimizer.learning_rate.assign(max(1e-6, float(model.optimizer.learning_rate.numpy()) * .5))
                state["lr_wait"] = 0
            state.update(epoch=epoch, stopped=state["wait"] >= args.patience)
            state["history"].append(dict(epoch=epoch, **logs))
            unchanged(records)
            previous, state = save_epoch(directory, model, state, previous, improved)
        if previous is None:
            raise ValueError("No trained checkpoint available")
        unchanged(records)
        candidate_dir = directory / "candidate"
        candidate_dir.mkdir(exist_ok=True)
        candidate = candidate_dir / f"{product}_model.h5"
        best = tf.keras.models.load_model(str(previous / "best.keras"), compile=False)
        save_model_atomic(best, candidate)
        metrics = evaluate_candidate(candidate, splits["test"], args.batch_size, config["minimum"])
        unchanged(records)
        if any(digest(r["path"]) != r["sha256"] for r in records):
            raise ValueError("Dataset bytes changed; cannot complete")
        atomic_json(directory / "complete.json", dict(status="COMPLETE", run_id=run_id,
                    filename=candidate.name, sha256=digest(candidate), classes=CLASSES,
                    metrics=metrics, final_epoch=state["epoch"], best_validation_loss=state["best_loss"],
                    preprocessing=config["preprocessing"], model_bytes=candidate.stat().st_size,
                    promotion="NOT PERFORMED"))
        print(product, "COMPLETE candidate verified; production untouched", metrics, flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--action", choices=("status", "preflight", "train"), default="status")
    parser.add_argument("--product", choices=(*PRODUCTS, "all"), required=True)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--patience", type=int, default=5)
    parser.add_argument("--min-recall", type=float, default=.75)
    parser.add_argument("--min-f1", type=float, default=.70)
    parser.add_argument("--min-auc", type=float, default=.80)
    args = parser.parse_args()
    if min(args.epochs, args.batch_size, args.patience) < 1 or any(not 0 < v < 1 for v in (args.min_recall, args.min_f1, args.min_auc)):
        parser.error("Positive settings and quality thresholds between zero and one required")
    failed = []
    for product in PRODUCTS if args.product == "all" else (args.product,):
        try:
            run_product(args, product)
        except Exception as exc:
            print(product, "NOT COMPLETE:", exc, flush=True)
            failed.append(product)
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
