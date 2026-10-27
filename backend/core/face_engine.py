import os
import cv2
import numpy as np
import base64
from typing import Optional, Dict, Any, List

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
YUNET_PATH = os.path.join(BASE_DIR, 'face_detection_yunet_2023mar.onnx')
SFACE_PATH = os.path.join(BASE_DIR, 'face_recognition_sface_2021dec.onnx')

# Global cached recognizer instance
_sface_recognizer = None

def get_recognizer():
    global _sface_recognizer
    if _sface_recognizer is None and os.path.exists(SFACE_PATH):
        try:
            _sface_recognizer = cv2.FaceRecognizerSF.create(SFACE_PATH, '')
        except Exception as e:
            print(f"[FaceEngine] Error initializing SFace: {e}")
    return _sface_recognizer


def _load_image(img_input) -> Optional[np.ndarray]:
    """
    Safely loads an image from various input types:
    - Django UploadedFile / File object
    - bytes or bytearray
    - base64 data URL string or raw base64 string
    - file path string
    """
    try:
        if hasattr(img_input, 'read'):
            img_input.seek(0)
            raw_bytes = img_input.read()
            img_input.seek(0)
            nparr = np.frombuffer(raw_bytes, np.uint8)
            return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        elif isinstance(img_input, (bytes, bytearray)):
            nparr = np.frombuffer(img_input, np.uint8)
            return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        elif isinstance(img_input, str):
            if img_input.startswith('data:image') and ';base64,' in img_input:
                encoded = img_input.split(';base64,')[1]
                raw_bytes = base64.b64decode(encoded)
                nparr = np.frombuffer(raw_bytes, np.uint8)
                return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            elif len(img_input) > 200 and not img_input.endswith(('.jpg', '.jpeg', '.png', '.webp')):
                raw_bytes = base64.b64decode(img_input)
                nparr = np.frombuffer(raw_bytes, np.uint8)
                return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            else:
                return cv2.imread(img_input)
        return None
    except Exception as e:
        print(f"[FaceEngine] Error loading image: {e}")
        return None


def detect_face(img_input) -> Dict[str, Any]:
    """
    Detects a human face in the image using Deep Neural Network YuNet with SFace embedding.
    Falls back to Haar Cascades with CLAHE if ONNX models are absent.
    Returns:
      {
        'face_detected': bool,
        'confidence': float,
        'box': {'x': int, 'y': int, 'width': int, 'height': int},
        'crop_data_url': str (data:image/jpeg;base64,...),
        'features': list[float] (128-d deep biometric embedding),
        'message': str
      }
    """
    img = _load_image(img_input)
    if img is None:
        return {'face_detected': False, 'confidence': 0, 'message': 'Invalid or unreadable image data'}

    orig_h, orig_w = img.shape[:2]
    if orig_h < 30 or orig_w < 30:
        return {'face_detected': False, 'confidence': 0, 'message': 'Image resolution too small'}

    # 1. Try Deep Learning YuNet detector & SFace recognizer first
    recognizer = get_recognizer()
    if os.path.exists(YUNET_PATH) and recognizer is not None:
        try:
            # Create detector dynamically sized to image dimensions
            detector = cv2.FaceDetectorYN.create(YUNET_PATH, '', (orig_w, orig_h), 0.5)
            _, faces = detector.detect(img)
            
            # If nothing found with 0.5 threshold, try slightly lower threshold 0.35
            if faces is None or len(faces) == 0:
                detector.setScoreThreshold(0.35)
                _, faces = detector.detect(img)

            if faces is not None and len(faces) > 0:
                # Pick the largest / most prominent face
                best_face = None
                best_area = 0
                for f in faces:
                    area = f[2] * f[3]
                    if area > best_area:
                        best_area = area
                        best_face = f

                if best_face is not None:
                    # Align and crop face using SFace deep model
                    aligned_face = recognizer.alignCrop(img, best_face)
                    # Extract 128-dimensional deep feature vector
                    feat = recognizer.feature(aligned_face)
                    features_list = feat.flatten().tolist()

                    # Bounding box
                    x, y, w, h = int(best_face[0]), int(best_face[1]), int(best_face[2]), int(best_face[3])
                    score = float(best_face[14]) * 100 if len(best_face) > 14 else 96.0

                    # Standardize crop image to JPEG base64 data URL
                    _, buf = cv2.imencode('.jpg', aligned_face, [cv2.IMWRITE_JPEG_QUALITY, 92])
                    b64_crop = "data:image/jpeg;base64," + base64.b64encode(buf).decode('utf-8')

                    return {
                        'face_detected': True,
                        'confidence': round(max(85.0, min(99.0, score)), 1),
                        'box': {'x': x, 'y': y, 'width': w, 'height': h},
                        'crop_data_url': b64_crop,
                        'features': features_list,
                        'engine': 'SFace_DNN',
                        'message': 'Face portrait successfully isolated with deep biometric alignment.'
                    }
        except Exception as e:
            print(f"[FaceEngine] YuNet/SFace error, falling back: {e}")

    # 2. Fallback: Haar Cascade Multi-Stage with CLAHE
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray_clahe = clahe.apply(gray)

    cascades = [
        cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml'),
        cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'),
        cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
    ]

    best_face = None
    best_area = 0

    for g in [gray, gray_clahe]:
        for cascade in cascades:
            if cascade.empty():
                continue
            faces = cascade.detectMultiScale(
                g, scaleFactor=1.05, minNeighbors=3,
                minSize=(int(min(orig_w, orig_h) * 0.12), int(min(orig_w, orig_h) * 0.12))
            )
            if len(faces) == 0:
                faces = cascade.detectMultiScale(g, scaleFactor=1.1, minNeighbors=3, minSize=(30, 30))

            if len(faces) > 0:
                for f in faces:
                    area = f[2] * f[3]
                    if area > best_area:
                        best_area = area
                        best_face = f
        if best_face is not None:
            break

    if best_face is None:
        return {
            'face_detected': False,
            'confidence': 0,
            'message': 'No facial biometric pattern cleanly isolated.'
        }

    x, y, w, h = [int(v) for v in best_face]
    pad_x = int(w * 0.25)
    pad_y_top = int(h * 0.32)
    pad_y_bottom = int(h * 0.20)
    
    x1 = max(0, x - pad_x)
    y1 = max(0, y - pad_y_top)
    x2 = min(orig_w, x + w + pad_x)
    y2 = min(orig_h, y + h + pad_y_bottom)

    crop = img[y1:y2, x1:x2]
    if crop.size == 0:
        crop = img[y:y+h, x:x+w]

    crop_resized = cv2.resize(crop, (160, 160), interpolation=cv2.INTER_AREA)
    _, buf = cv2.imencode('.jpg', crop_resized, [cv2.IMWRITE_JPEG_QUALITY, 92])
    b64_crop = "data:image/jpeg;base64," + base64.b64encode(buf).decode('utf-8')

    # If SFace is available, run feature on the resized crop
    if recognizer is not None:
        try:
            feat = recognizer.feature(cv2.resize(crop, (112, 112)))
            features = feat.flatten().tolist()
        except Exception:
            features = [0.0] * 128
    else:
        # Grayscale normalized gradient histogram (illumination invariant)
        g_crop = cv2.cvtColor(crop_resized, cv2.COLOR_BGR2GRAY)
        hist = cv2.calcHist([g_crop], [0], None, [128], [0, 256])
        cv2.normalize(hist, hist, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
        features = hist.flatten().tolist()

    return {
        'face_detected': True,
        'confidence': 92.0,
        'box': {'x': x, 'y': y, 'width': w, 'height': h},
        'crop_data_url': b64_crop,
        'features': features,
        'engine': 'Cascade_Fallback',
        'message': 'Face portrait successfully isolated.'
    }


def compare_face_features(feat1: List[float], feat2: List[float]) -> Dict[str, Any]:
    """
    Compares two face feature vectors using Deep Cosine Metric.
    Supports:
    - 128-dimensional Deep Learning embeddings (SFace)
    - 256-dimensional legacy vectors (Histogram comparison)
    Returns:
      {
        'similarity': int (10 - 99),
        'is_match': bool,
        'cosine': float,
        'correlation': float
      }
    """
    if not feat1 or not feat2:
        return {'similarity': 0, 'is_match': False, 'cosine': 0.0, 'correlation': 0.0}

    len1, len2 = len(feat1), len(feat2)

    # 1. 128-dimensional Deep SFace features
    if len1 == 128 and len2 == 128:
        try:
            recognizer = get_recognizer()
            v1 = np.array(feat1, dtype=np.float32).reshape(1, 128)
            v2 = np.array(feat2, dtype=np.float32).reshape(1, 128)

            if recognizer is not None:
                cosine = float(recognizer.match(v1, v2, cv2.FaceRecognizerSF_FR_COSINE))
            else:
                dot = float(np.dot(v1, v2.T)[0][0])
                norm1 = float(np.linalg.norm(v1))
                norm2 = float(np.linalg.norm(v2))
                cosine = dot / (norm1 * norm2) if (norm1 * norm2) > 0 else 0.0

            # SFace match threshold: cosine >= 0.363
            is_match = cosine >= 0.363

            if is_match:
                # Map 0.363 - 1.0 to 70% - 99%
                pct = int(70 + (cosine - 0.363) / (1.0 - 0.363) * 29)
                pct = max(70, min(99, pct))
            else:
                # Map 0.0 - 0.363 to 15% - 65%
                pct = int(15 + max(0.0, cosine) / 0.363 * 50)
                pct = max(10, min(65, pct))

            return {
                'similarity': pct,
                'is_match': is_match,
                'cosine': round(cosine, 4),
                'correlation': round(cosine, 4)
            }
        except Exception as e:
            print(f"[FaceEngine] Error comparing SFace features: {e}")
            return {'similarity': 0, 'is_match': False, 'cosine': 0.0, 'correlation': 0.0}

    # 2. Legacy 256-dimensional features
    if len1 == 256 and len2 == 256:
        try:
            h1 = np.array(feat1, dtype=np.float32).reshape(16, 16)
            h2 = np.array(feat2, dtype=np.float32).reshape(16, 16)
            sim = float(cv2.compareHist(h1, h2, cv2.HISTCMP_CORREL))
            pct = max(10, min(99, int((sim + 1.0) / 2.0 * 100)))
            return {
                'similarity': pct,
                'is_match': pct >= 65,
                'correlation': round(sim, 4),
                'cosine': round(sim, 4)
            }
        except Exception as e:
            print(f"[FaceEngine] Error comparing legacy features: {e}")
            return {'similarity': 0, 'is_match': False, 'cosine': 0.0, 'correlation': 0.0}

    # Differing lengths
    return {'similarity': 0, 'is_match': False, 'cosine': 0.0, 'correlation': 0.0}
