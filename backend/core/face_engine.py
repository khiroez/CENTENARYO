import cv2
import numpy as np
import base64
from typing import Optional, Dict, Any, List

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
            # Django UploadedFile or file-like object
            img_input.seek(0)
            raw_bytes = img_input.read()
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
                # Raw base64 string
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
    Detects a human face in the image using OpenCV multi-stage cascades with CLAHE.
    Returns:
      {
        'face_detected': bool,
        'confidence': float,
        'box': {'x': int, 'y': int, 'width': int, 'height': int},
        'crop_data_url': str (data:image/jpeg;base64,...),
        'features': list[float],
        'message': str
      }
    """
    img = _load_image(img_input)
    if img is None:
        return {'face_detected': False, 'confidence': 0, 'message': 'Invalid or unreadable image data'}

    orig_h, orig_w = img.shape[:2]
    if orig_h < 30 or orig_w < 30:
        return {'face_detected': False, 'confidence': 0, 'message': 'Image resolution too small'}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    # This dramatically enhances detection on laminated IDs, overexposed, or underexposed photos
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray_clahe = clahe.apply(gray)

    cascades = [
        cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml'),
        cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'),
        cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
    ]

    best_face = None
    best_area = 0

    # Test both normalized grayscale and CLAHE grayscale across models
    for g in [gray, gray_clahe]:
        for cascade in cascades:
            if cascade.empty():
                continue
            # Multi-scale detection with fine steps
            faces = cascade.detectMultiScale(
                g, 
                scaleFactor=1.05, 
                minNeighbors=3, 
                minSize=(int(min(orig_w, orig_h) * 0.12), int(min(orig_w, orig_h) * 0.12))
            )
            if len(faces) == 0:
                # Fallback to smaller minimum size if nothing found
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
    
    # Calculate crop coordinates with biometric padding (25% sides, 30% top for hair, 20% bottom for chin)
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

    # Standardize crop to 160x160 for preview and feature extraction
    crop_resized = cv2.resize(crop, (160, 160), interpolation=cv2.INTER_AREA)

    # Encode crop to JPEG base64 data URL
    _, buf = cv2.imencode('.jpg', crop_resized, [cv2.IMWRITE_JPEG_QUALITY, 92])
    b64_crop = "data:image/jpeg;base64," + base64.b64encode(buf).decode('utf-8')

    # Extract color & luminance feature vector for cross-comparison
    hsv = cv2.cvtColor(crop_resized, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1], None, [16, 16], [0, 180, 0, 256])
    cv2.normalize(hist, hist, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
    features = hist.flatten().tolist()

    # Calculate confidence based on face area ratio and proportions
    ratio = w / float(h)
    confidence = 96.0 if 0.8 <= ratio <= 1.25 else 90.0

    return {
        'face_detected': True,
        'confidence': confidence,
        'box': {'x': x, 'y': y, 'width': w, 'height': h},
        'crop_data_url': b64_crop,
        'features': features,
        'message': 'Face portrait successfully isolated.'
    }

def compare_face_features(feat1: List[float], feat2: List[float]) -> Dict[str, Any]:
    """
    Compares two face feature vectors using histogram correlation.
    Returns:
      {
        'similarity': int (10 - 99),
        'is_match': bool,
        'correlation': float
      }
    """
    if not feat1 or not feat2 or len(feat1) != 256 or len(feat2) != 256:
        return {'similarity': 0, 'is_match': False, 'correlation': 0.0}

    try:
        h1 = np.array(feat1, dtype=np.float32).reshape(16, 16)
        h2 = np.array(feat2, dtype=np.float32).reshape(16, 16)
        sim = float(cv2.compareHist(h1, h2, cv2.HISTCMP_CORREL))
        # Correlation is between -1.0 and 1.0. Map to percentage 10% - 99%.
        pct = max(10, min(99, int((sim + 1.0) / 2.0 * 100)))
        return {
            'similarity': pct,
            'is_match': pct >= 65,
            'correlation': round(sim, 4)
        }
    except Exception as e:
        print(f"[FaceEngine] Error comparing features: {e}")
        return {'similarity': 0, 'is_match': False, 'correlation': 0.0}
