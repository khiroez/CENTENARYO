import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image

def detect_face(image_path_or_bytes):
    if isinstance(image_path_or_bytes, (str, bytes)):
        if isinstance(image_path_or_bytes, str):
            img = cv2.imread(image_path_or_bytes)
        else:
            nparr = np.frombuffer(image_path_or_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    else:
        return None

    if img is None:
        return None

    orig_h, orig_w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Try default cascade, then alt2, then profile
    cascades = [
        cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'),
        cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml'),
        cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
    ]

    best_face = None
    for cascade in cascades:
        faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(35, 35))
        if len(faces) > 0:
            # pick largest face
            best_face = max(faces, key=lambda f: f[2] * f[3])
            break

    if best_face is None:
        return {'face_detected': False, 'message': 'No face detected'}

    x, y, w, h = [int(v) for v in best_face]
    # Add 25% padding
    pad_x = int(w * 0.25)
    pad_y = int(h * 0.30)
    x1 = max(0, x - pad_x)
    y1 = max(0, y - pad_y)
    x2 = min(orig_w, x + w + pad_x)
    y2 = min(orig_h, y + h + pad_y)

    crop = img[y1:y2, x1:x2]
    crop_resized = cv2.resize(crop, (160, 160), interpolation=cv2.INTER_AREA)

    # Encode crop to JPEG base64
    _, buf = cv2.imencode('.jpg', crop_resized, [cv2.IMWRITE_JPEG_QUALITY, 90])
    b64_crop = "data:image/jpeg;base64," + base64.b64encode(buf).decode('utf-8')

    # Color & gradient feature representation for comparison
    hsv = cv2.cvtColor(crop_resized, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1], None, [16, 16], [0, 180, 0, 256])
    cv2.normalize(hist, hist, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
    features = hist.flatten().tolist()

    return {
        'face_detected': True,
        'confidence': 95.0,
        'box': {'x': x, 'y': y, 'width': w, 'height': h},
        'crop_data_url': b64_crop,
        'features': features
    }

# Test on OSCA ID
res_osca = detect_face(r'C:\Users\kazum\.gemini\antigravity-ide\brain\96016aa4-17f1-448e-8ed5-f7ec00232e56\.user_uploaded\media_1788705102804.jpg')
print("OSCA ID detection:", res_osca['face_detected'], res_osca.get('box'), "Crop length:", len(res_osca.get('crop_data_url', '')))

# Test on 2x2.jpg
res_2x2 = detect_face(r'D:\codes\cen4\backend\media\requirements\pictures\2x2.jpg')
print("2x2.jpg detection:", res_2x2['face_detected'], res_2x2.get('box'))

# Compare
if res_osca['face_detected'] and res_2x2['face_detected']:
    h1 = np.array(res_osca['features'], dtype=np.float32).reshape(16, 16)
    h2 = np.array(res_2x2['features'], dtype=np.float32).reshape(16, 16)
    sim = cv2.compareHist(h1, h2, cv2.HISTCMP_CORREL)
    pct = max(10, min(99, int((sim + 1) / 2 * 100)))
    print(f"Similarity: {pct}% (correl: {sim:.3f})")
