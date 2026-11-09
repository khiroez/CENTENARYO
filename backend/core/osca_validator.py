import os
import re
import cv2
import numpy as np
from datetime import date
from PIL import Image
from typing import Dict, Any, Optional, Tuple, List

from .face_engine import _load_image, detect_face
from .qr_engine import decode_qr

# Base directory for reference templates
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), 'templates_osca')
BLANK_TEMPLATE_PATH = os.path.join(TEMPLATES_DIR, 'oscaid_template_without_info.png')
FILLED_TEMPLATE_PATH = os.path.join(TEMPLATES_DIR, 'oscaid_template_with_info.jpg')
QC_LOGO_PATH = os.path.join(TEMPLATES_DIR, 'qc_logo_crop.png')
QC_LOGO_PHOTO_PATH = os.path.join(TEMPLATES_DIR, 'qc_logo_photo.png')
OSCA_LOGO_PATH = os.path.join(TEMPLATES_DIR, 'osca_logo_crop.png')
HEADER_BANNER_PATH = os.path.join(TEMPLATES_DIR, 'header_crop.png')
OCRA_DIGITS_PATH = os.path.join(TEMPLATES_DIR, 'ocra_digits.npy')

_OCRA_PROTOS: Optional[np.ndarray] = None
_TEMPLATE_CACHE: Dict[str, Optional[np.ndarray]] = {}


def _get_cached_template(path: str) -> Optional[np.ndarray]:
    if path not in _TEMPLATE_CACHE:
        _TEMPLATE_CACHE[path] = cv2.imread(path) if os.path.exists(path) else None
    return _TEMPLATE_CACHE[path]

# Required field labels for Stage 1
REQUIRED_STAGE1_LABELS = [
    {"key": "name", "label": "Last Name, First Name, Middle Name", "keywords": ["last name", "first name", "middle name", "m.i."]},
    {"key": "sex", "label": "Sex", "keywords": ["sex"]},
    {"key": "dob", "label": "Date of Birth", "keywords": ["date of birth", "birth"]},
    {"key": "civil_status", "label": "Civil Status", "keywords": ["civil status", "status"]},
    {"key": "blood_type", "label": "Blood Type", "keywords": ["blood type", "blood"]},
    {"key": "date_issued", "label": "Date Issued", "keywords": ["date issued", "issued"]},
    {"key": "valid_until", "label": "Valid Until", "keywords": ["valid until", "until"]},
    {"key": "cardholder_signature", "label": "Cardholder Signature", "keywords": ["cardholder signature", "signature"]},
    {"key": "emergency_contact", "label": "Emergency Contact", "keywords": ["in case of emergency", "emergency", "contact"]},
]

_CIVIL_STATUS_RE = re.compile(r'\b(SINGLE|MARRIED|WIDOWED|WIDOWER|WIDOW/ER|WIDOW|SEPARATED|DIVORCED|ANNULLED)\b')
_ADDRESS_RE = re.compile(
    r'\b(STREET|ST|AVENUE|AVE|ROAD|RD|DRIVE|DR|BLOCK|BLK|LOT|PHASE|VILLAGE|SUBD|SUBDIVISION|'
    r'BARANGAY|BRGY|CITY|TOWNHOMES|COMPOUND|EXTENSION|EXT)\b'
)
_DIGIT_FIXUPS = str.maketrans({'B': '8', 'O': '0', 'D': '0', 'I': '1', 'L': '1', 'S': '5', 'Z': '2', 'G': '6'})


def _get_ocra_protos() -> Optional[np.ndarray]:
    global _OCRA_PROTOS
    if _OCRA_PROTOS is None and os.path.exists(OCRA_DIGITS_PATH):
        try:
            _OCRA_PROTOS = np.load(OCRA_DIGITS_PATH).astype(np.float32)
        except Exception:
            _OCRA_PROTOS = None
    return _OCRA_PROTOS


def _ensure_template_crops():
    if not os.path.exists(BLANK_TEMPLATE_PATH):
        return
    blank = cv2.imread(BLANK_TEMPLATE_PATH)
    if blank is None:
        return

    if blank.shape[:2] != (672, 1024):
        blank = cv2.resize(blank, (1024, 672), interpolation=cv2.INTER_AREA)

    if not os.path.exists(QC_LOGO_PATH):
        qc_logo = blank[60:215, 60:255]
        cv2.imwrite(QC_LOGO_PATH, qc_logo)

    if not os.path.exists(OSCA_LOGO_PATH):
        osca_logo = blank[65:215, 805:955]
        cv2.imwrite(OSCA_LOGO_PATH, osca_logo)

    if not os.path.exists(HEADER_BANNER_PATH):
        header = blank[20:200, 260:800]
        cv2.imwrite(HEADER_BANNER_PATH, header)


_ensure_template_crops()


def _normalize_image_for_matching(img: np.ndarray, target_w: int = 1024, target_h: int = 672) -> np.ndarray:
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    elif img.shape[2] == 4:
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

    h, w = img.shape[:2]
    if (w, h) != (target_w, target_h):
        return cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_AREA)
    return img


from concurrent.futures import ThreadPoolExecutor

# Dedicated single-thread executor for WinRT OCR so COM/WinRT objects (Language, OcrEngine, SoftwareBitmap)
# are initialized, cached, used, and released on a single persistent OS thread and never cross threads.
_WINOCR_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="winocr_com_thread")
_WINOCR_STATE: Dict[str, Any] = {"lang": None, "engine": None}


def _winocr_worker_task(rgba_bytes: bytes, width: int, height: int) -> str:
    import asyncio
    from winrt.windows.media.ocr import OcrEngine
    from winrt.windows.globalization import Language
    from winrt.windows.storage.streams import DataWriter
    from winrt.windows.graphics.imaging import SoftwareBitmap, BitmapPixelFormat

    if _WINOCR_STATE["engine"] is None:
        lang_obj = Language("en-US")
        _WINOCR_STATE["lang"] = lang_obj
        _WINOCR_STATE["engine"] = OcrEngine.try_create_from_language(lang_obj)

    engine = _WINOCR_STATE["engine"]
    if engine is None:
        return ""

    writer = DataWriter()
    writer.write_bytes(rgba_bytes)
    buf = writer.detach_buffer()
    sb = SoftwareBitmap.create_copy_from_buffer(buf, BitmapPixelFormat.RGBA8, width, height)

    async def _run():
        return await engine.recognize_async(sb)

    res = asyncio.run(_run())
    text = str(res.text) if (res and hasattr(res, "text") and res.text) else ""
    del res, sb, buf, writer
    return text


def _winocr_lines_worker_task(rgba_bytes: bytes, width: int, height: int) -> Tuple[str, List[Dict[str, Any]]]:
    import asyncio
    from winrt.windows.media.ocr import OcrEngine
    from winrt.windows.globalization import Language
    from winrt.windows.storage.streams import DataWriter
    from winrt.windows.graphics.imaging import SoftwareBitmap, BitmapPixelFormat

    if _WINOCR_STATE["engine"] is None:
        lang_obj = Language("en-US")
        _WINOCR_STATE["lang"] = lang_obj
        _WINOCR_STATE["engine"] = OcrEngine.try_create_from_language(lang_obj)

    engine = _WINOCR_STATE["engine"]
    if engine is None:
        return "", []

    writer = DataWriter()
    writer.write_bytes(rgba_bytes)
    buf = writer.detach_buffer()
    sb = SoftwareBitmap.create_copy_from_buffer(buf, BitmapPixelFormat.RGBA8, width, height)

    async def _run():
        return await engine.recognize_async(sb)

    res = asyncio.run(_run())
    text = str(res.text) if (res and hasattr(res, "text") and res.text) else ""
    out_lines: List[Dict[str, Any]] = []
    if res and hasattr(res, "lines") and width > 0 and height > 0:
        for ln in res.lines:
            wds = []
            for wd in ln.words:
                r = wd.bounding_rect
                wds.append({
                    "text": str(wd.text),
                    "x": round(r.x / width, 3),
                    "y": round(r.y / height, 3),
                    "w": round(r.width / width, 3),
                    "h": round(r.height / height, 3),
                })
            out_lines.append({
                "text": str(ln.text),
                "words": wds,
                "x": min(wd["x"] for wd in wds) if wds else 0.0,
                "y": min(wd["y"] for wd in wds) if wds else 0.0,
            })
    del res, sb, buf, writer
    return text, out_lines


def safe_winocr_lines_bgr(bgr_img: np.ndarray) -> Tuple[str, List[Dict[str, Any]]]:
    """Thread-safe WinRT OCR wrapper returning (full_text, lines_with_normalized_word_boxes)."""
    try:
        if bgr_img is None or bgr_img.size == 0:
            return "", []
        if bgr_img.ndim == 2:
            rgba = cv2.cvtColor(bgr_img, cv2.COLOR_GRAY2RGBA)
        elif bgr_img.shape[2] == 4:
            rgba = cv2.cvtColor(bgr_img, cv2.COLOR_BGRA2RGBA)
        else:
            rgba = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGBA)
        h, w = rgba.shape[:2]
        future = _WINOCR_EXECUTOR.submit(_winocr_lines_worker_task, rgba.tobytes(), w, h)
        return future.result(timeout=10.0)
    except Exception as e:
        print(f"[WinOCR Lines] Notice: {e}")
        return "", []


def safe_winocr_recognize_pil(pil_img: Image.Image) -> str:
    """Thread-safe WinRT OCR wrapper that prevents 0xC0000005 COM apartment crashes in Django."""
    try:
        if pil_img.mode != "RGBA":
            pil_img = pil_img.convert("RGBA")
        raw = pil_img.tobytes()
        w, h = pil_img.width, pil_img.height
        future = _WINOCR_EXECUTOR.submit(_winocr_worker_task, raw, w, h)
        return future.result(timeout=10.0)
    except Exception as e:
        print(f"[WinOCR] Notice: {e}")
        return ""


def _extract_ocr_text(img: np.ndarray) -> str:
    try:
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb)
        text = safe_winocr_recognize_pil(pil_img)
        if text:
            return text
    except Exception as e:
        print(f"[OSCA Validator] winocr error: {e}")

    try:
        import pytesseract
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        return pytesseract.image_to_string(rgb)
    except Exception:
        pass

    return ""


def _match_template_multiscale(search_img: np.ndarray, template_img: np.ndarray, scales=None) -> float:
    """Finds best match score of a template across multiple scales."""
    if search_img is None or template_img is None:
        return 0.0

    if scales is None:
        scales = np.linspace(0.45, 1.35, 19)

    gray_search = cv2.cvtColor(search_img, cv2.COLOR_BGR2GRAY) if search_img.ndim == 3 else search_img
    gray_tpl = cv2.cvtColor(template_img, cv2.COLOR_BGR2GRAY) if template_img.ndim == 3 else template_img

    best_score = 0.0
    for scale in scales:
        th, tw = int(gray_tpl.shape[0] * scale), int(gray_tpl.shape[1] * scale)
        if th >= gray_search.shape[0] or tw >= gray_search.shape[1] or th < 20 or tw < 20:
            continue
        interp = cv2.INTER_AREA if scale < 1.0 else cv2.INTER_CUBIC
        scaled_tpl = cv2.resize(gray_tpl, (tw, th), interpolation=interp)
        res = cv2.matchTemplate(gray_search, scaled_tpl, cv2.TM_CCOEFF_NORMED)
        _, max_v, _, _ = cv2.minMaxLoc(res)
        if max_v > best_score:
            best_score = float(max_v)
            if best_score >= 0.95:
                break
    return best_score


def _detect_id_number_under_qr(img: np.ndarray, qr_box: Optional[Tuple[int, int, int, int]] = None) -> Tuple[bool, str]:
    """
    Locates and reads the OSCA ID number directly under the QR code.
    Combines connected-component glyph segmentation with an OCR-A prototype digit classifier
    (because Windows OCR drops the stylized OCR-A digits printed on QC Citizen Cards) plus WinOCR fallback.
    """
    h, w = img.shape[:2]

    if qr_box:
        min_x, max_y, max_x, _ = qr_box
        w_qr = max_x - min_x
        x1 = max(0, min_x - int(w_qr * 0.25))
        x2 = min(w, max_x + int(w_qr * 0.25))
        y1 = max_y
        y2 = min(h, max_y + int(w_qr * 0.48))
    else:
        x1 = int(w * 0.58)
        x2 = int(w * 0.98)
        y1 = int(h * 0.76)
        y2 = int(h * 0.98)

    under_crop = img[y1:y2, x1:x2]
    if under_crop.size == 0 or under_crop.shape[0] < 10 or under_crop.shape[1] < 20:
        return False, ""

    # 1. Connected Component Glyph Segmentation + OCR-A Prototype Classification
    gray = cv2.cvtColor(under_crop, cv2.COLOR_BGR2GRAY) if under_crop.ndim == 3 else under_crop
    _, bin_inv = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    num_labels, _, stats, _ = cv2.connectedComponentsWithStats(bin_inv)

    crop_h = under_crop.shape[0]
    glyph_boxes: List[Tuple[int, int, int, int]] = []
    for i in range(1, num_labels):
        gx, gy, gw, gh, garea = stats[i]
        if int(crop_h * 0.12) <= gh <= int(crop_h * 0.80) and 3 <= gw <= int(crop_h * 0.75) and garea >= 15:
            glyph_boxes.append((int(gx), int(gy), int(gw), int(gh)))

    glyph_boxes.sort(key=lambda b: b[0])
    aligned_boxes: List[Tuple[int, int, int, int]] = []
    if len(glyph_boxes) >= 3:
        med_y = float(np.median([b[1] for b in glyph_boxes]))
        med_h = float(np.median([b[3] for b in glyph_boxes]))
        aligned_boxes = [
            b for b in glyph_boxes
            if abs(b[1] - med_y) <= med_h * 0.55 and abs(b[3] - med_h) <= med_h * 0.50
        ]

    has_glyph_cluster = len(aligned_boxes) >= 3
    proto_digits = ""
    protos = _get_ocra_protos()
    if protos is not None and len(aligned_boxes) >= 6:
        decoded_chars = []
        for (gx, gy, gw, gh) in aligned_boxes:
            patch = cv2.resize(bin_inv[gy:gy + gh, gx:gx + gw], (16, 24), interpolation=cv2.INTER_AREA).astype(np.float32).ravel()
            if np.std(patch) > 1e-3:
                scores = [float(np.corrcoef(patch, protos[d].ravel())[0, 1]) for d in range(10)]
                decoded_chars.append(str(int(np.argmax(scores))))
        if len(decoded_chars) >= 6:
            proto_digits = "".join(decoded_chars)

    # Prefer the full OCR-A glyph sequence immediately when it reads a 10..18 digit ID (avoids extra WinOCR pass)
    if 10 <= len(proto_digits) <= 18:
        return True, proto_digits

    # 2. WinOCR fallback on the crop only when glyph classifier did not find a full ID
    ocr_res = _extract_ocr_text(under_crop).strip()
    cleaned = re.sub(r'[^0-9A-Za-z\-\s]', '', ocr_res).strip()
    tokens = [t for t in cleaned.split() if any(c.isdigit() for c in t) or t in ['BBB', '888', 'OSCA']]
    ocr_text_val = " ".join(tokens) if tokens else cleaned

    is_present = bool(tokens) or has_glyph_cluster or len(cleaned) >= 3
    return is_present, proto_digits or ocr_text_val


def validate_stage1_structure(img_norm: np.ndarray, ocr_text: str) -> Dict[str, Any]:
    """
    Stage 1: oscaid_template_without_info (Structural & Layout Verification)
    """
    results: Dict[str, Any] = {
        'stage': 1,
        'passed': False,
        'layout_score': 0.0,
        'qc_logo_detected': False,
        'qc_logo_score': 0.0,
        'osca_logo_detected': False,
        'osca_logo_score': 0.0,
        'labels_check': {},
        'missing_labels': [],
        'reasons': []
    }

    qc_logo = _get_cached_template(QC_LOGO_PATH)
    qc_logo_photo = _get_cached_template(QC_LOGO_PHOTO_PATH)
    osca_logo = _get_cached_template(OSCA_LOGO_PATH)
    header_crop = _get_cached_template(HEADER_BANNER_PATH)

    search_region_qc = img_norm[0:360, 0:400]
    score_qc1 = _match_template_multiscale(search_region_qc, qc_logo) if qc_logo is not None else 0.0
    score_qc2 = _match_template_multiscale(search_region_qc, qc_logo_photo) if qc_logo_photo is not None else 0.0
    best_qc_score = max(score_qc1, score_qc2)
    results['qc_logo_score'] = round(best_qc_score * 100, 1)

    results['qc_logo_detected'] = (best_qc_score >= 0.55) or ("PILIPINAS" in ocr_text.upper() and best_qc_score >= 0.40)
    if not results['qc_logo_detected']:
        results['reasons'].append("Lungsod Quezon logo is missing or unrecognized.")

    search_region_osca = img_norm[0:360, 680:1024]
    best_osca_score = _match_template_multiscale(search_region_osca, osca_logo) if osca_logo is not None else 0.0
    results['osca_logo_score'] = round(best_osca_score * 100, 1)
    results['osca_logo_detected'] = (best_osca_score >= 0.55) or ("SENIOR CITIZENS" in ocr_text.upper() and best_osca_score >= 0.40)
    if not results['osca_logo_detected']:
        results['reasons'].append("Office for Senior Citizens' Affairs (OSCA) logo is missing or unrecognized.")

    if header_crop is not None:
        search_region_hdr = img_norm[0:300, 150:900]
        score_hdr = _match_template_multiscale(search_region_hdr, header_crop)
        results['layout_score'] = round(score_hdr * 100, 1)
    else:
        results['layout_score'] = 85.0

    lower_ocr = ocr_text.lower()
    labels_status = {}
    missing = []

    for item in REQUIRED_STAGE1_LABELS:
        key = item['key']
        found = any(kw in lower_ocr for kw in item['keywords'])
        labels_status[key] = {
            'label': item['label'],
            'present': found
        }
        if not found:
            missing.append(item['label'])

    results['labels_check'] = labels_status
    results['missing_labels'] = missing

    labels_passed_count = sum(1 for v in labels_status.values() if v['present'])
    has_logos = results['qc_logo_detected'] and results['osca_logo_detected']
    has_layout = results['qc_logo_detected'] and (results['layout_score'] >= 55.0 or labels_passed_count >= 5)

    if has_logos or has_layout:
        results['passed'] = True
    else:
        results['passed'] = False
        if labels_passed_count < 5:
            results['reasons'].append(f"Missing required field labels: {', '.join(missing[:3])}...")

    return results


def _normalize_civil_status(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    raw = raw.upper()
    if raw.startswith('WIDOW'):
        return 'WIDOWED'
    return raw


def _to_iso(y: int, m: int, d: int) -> Optional[str]:
    try:
        return date(y, m, d).isoformat()
    except ValueError:
        return None


def _is_plausible_dob(iso: Optional[str]) -> bool:
    if not iso:
        return False
    year = int(iso[:4])
    return 1900 <= year <= date.today().year - 50


def _find_dates(text: str) -> List[Tuple[int, str]]:
    found: List[Tuple[int, str]] = []
    for m in re.finditer(r'\b(\d{4})[/\-.]?(\d{2})[/\-.]?(\d{2})\b', text):
        iso = _to_iso(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        if iso:
            found.append((m.start(), iso))
    for m in re.finditer(r'\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b', text):
        iso = _to_iso(int(m.group(3)), int(m.group(1)), int(m.group(2)))
        if iso:
            found.append((m.start(), iso))
    found.sort(key=lambda t: t[0])
    return found


def _clean_osca_digits(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    candidate = raw.upper().translate(_DIGIT_FIXUPS)
    digits = re.sub(r'\D', '', candidate)
    return digits if 10 <= len(digits) <= 18 else None


def _extract_sex_from_row_crop(img_norm: np.ndarray) -> Optional[str]:
    """
    Windows OCR drops a standalone single-character 'F'/'M' on full-card scans.
    Upscaling 4x the Sex + Date of Birth value row gives the character neighbour context so OCR reads it reliably.
    """
    row_crop = img_norm[313:352, 220:530]
    if row_crop.size == 0:
        return None
    up = cv2.resize(row_crop, None, fx=4.0, fy=4.0, interpolation=cv2.INTER_CUBIC)
    up = cv2.copyMakeBorder(up, 30, 30, 30, 30, cv2.BORDER_CONSTANT, value=(255, 255, 255))
    t = _extract_ocr_text(up).upper().strip()
    m = re.search(r'\b(FEMALE|MALE|F|M)\b', t)
    if m:
        return 'F' if m.group(1).startswith('F') else 'M'

    # Deterministic glyph fallback under the 'Sex' label (x: 240..320, y: 318..352)
    # Distinguishes 'F' vs 'M' by horizontal width-to-height ratio ('M' is wide, 'F' is narrow with top bar)
    sex_box = img_norm[318:352, 240:315]
    gray = cv2.cvtColor(sex_box, cv2.COLOR_BGR2GRAY) if sex_box.ndim == 3 else sex_box
    _, bin_inv = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    n_lbl, _, stats, _ = cv2.connectedComponentsWithStats(bin_inv)
    for i in range(1, n_lbl):
        gx, gy, gw, gh, area = stats[i]
        if 10 <= gh <= 28 and 5 <= gw <= 28 and area >= 25:
            glyph = bin_inv[gy:gy + gh, gx:gx + gw]
            top_half = float(np.sum(glyph[:gh // 2, :]))
            bot_half = float(np.sum(glyph[gh // 2:, :]))
            aspect = gw / float(gh)
            if aspect >= 0.78:
                return 'M'
            elif top_half > bot_half * 1.15:
                return 'F'
    return None


def _extract_fields_from_ocr(ocr_text: str, under_qr_text: str, img_norm: Optional[np.ndarray] = None) -> Dict[str, Optional[str]]:
    """Primary extraction: parse the printed card text."""
    text = " ".join(ocr_text.split()).upper()
    fields: Dict[str, Optional[str]] = {'name': None, 'osca_id': None, 'dob': None, 'sex': None, 'civil_status': None}

    # Full name printed after "Last Name, First Name, Middle Name / M.I."
    m = re.search(
        r'(?:MIDDLE\s+NAME|M\.\s*I\.?)\s*[:,]?\s*(.+?)\s+(?:SEX|DATE\s+OF\s+BIRTH|BLOOD\s+TYPE|CIVIL\s+STATUS)\b',
        text
    )
    if m:
        name = re.sub(r"[^A-ZÑ,.\-\s']", '', m.group(1)).strip(' ,.')
        if len([t for t in re.split(r'[\s,]+', name) if len(t) >= 2]) >= 2:
            fields['name'] = name

    # Date of birth: first plausible birth date (ignores Date Issued / Valid Until)
    for _, iso in _find_dates(text):
        if _is_plausible_dob(iso):
            fields['dob'] = iso
            break

    # Sex: look right after the "Sex" label, then fall back to 4x upscaled value-row OCR
    sm = re.search(r'\bSEX\b\s*[:.]?\s*(FEMALE|MALE|F|M)\b', text)
    if sm:
        fields['sex'] = 'F' if sm.group(1).startswith('F') else 'M'
    if not fields['sex'] and img_norm is not None:
        fields['sex'] = _extract_sex_from_row_crop(img_norm)

    cm = _CIVIL_STATUS_RE.search(text)
    if cm:
        fields['civil_status'] = _normalize_civil_status(cm.group(1))

    fields['osca_id'] = _clean_osca_digits(under_qr_text)
    return fields


def _extract_fields_from_qr(qr_payload: str) -> Dict[str, Optional[str]]:
    """
    Fallback extraction from the QR code payload when OCR cannot read a field.
    Supports:
    - Pipe-delimited QC Citizen Card format: NAME|OSCA_ID|DISTRICT|YYMMDD|SEX|BLOOD|...
    - Key-value / JSON payloads
    """
    fields: Dict[str, Optional[str]] = {'name': None, 'osca_id': None, 'dob': None, 'sex': None, 'civil_status': None}
    if not qr_payload:
        return fields

    if '|' in qr_payload:
        parts = [p.strip() for p in qr_payload.split('|')]
        if len(parts) >= 5:
            if re.search(r'[A-Za-z]{2,}', parts[0]):
                fields['name'] = parts[0].upper()
            if re.search(r'\d{8,18}', parts[1]):
                d = re.sub(r'\D', '', parts[1])
                fields['osca_id'] = d[:14] if len(d) == 16 and d.endswith('01') else d
            if re.fullmatch(r'\d{6}', parts[3]):
                iso = _to_iso(1900 + int(parts[3][:2]), int(parts[3][2:4]), int(parts[3][4:6]))
                if _is_plausible_dob(iso):
                    fields['dob'] = iso
            if parts[4].upper() in ('M', 'F', 'MALE', 'FEMALE'):
                fields['sex'] = parts[4].upper()[0]
            for seg in parts[5:]:
                cm = _CIVIL_STATUS_RE.search(seg.upper())
                if cm:
                    fields['civil_status'] = _normalize_civil_status(cm.group(1))
                    break
    return fields


def _merge_extracted_fields(ocr: Dict[str, Optional[str]], qr: Dict[str, Optional[str]]) -> Dict[str, Dict[str, Optional[str]]]:
    """OCR is primary; QR code is automatic fallback when OCR could not extract a field."""
    merged: Dict[str, Dict[str, Optional[str]]] = {}
    for key in ('name', 'osca_id', 'dob', 'sex', 'civil_status'):
        ocr_v, qr_v = ocr.get(key), qr.get(key)
        if ocr_v:
            merged[key] = {'value': ocr_v, 'source': 'OCR', 'ocr_value': ocr_v, 'qr_value': qr_v}
        elif qr_v:
            merged[key] = {'value': qr_v, 'source': 'QR', 'ocr_value': None, 'qr_value': qr_v}
        else:
            merged[key] = {'value': None, 'source': None, 'ocr_value': None, 'qr_value': None}
    return merged


def validate_stage2_content(img_norm: np.ndarray, ocr_text: str, raw_img: Optional[np.ndarray] = None, applicant_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Stage 2: oscaid_template_with_info (Data Content & Completeness Verification)
    Also returns `extracted_fields` read purely from the uploaded ID (OCR primary, QR fallback)
    for frontend/backend cross-verification against the applicant form.
    """
    results: Dict[str, Any] = {
        'stage': 2,
        'passed': False,
        'personal_info_populated': False,
        'address_present': False,
        'photo_present': False,
        'qr_code_present': False,
        'qr_data': None,
        'osca_number_present': False,
        'osca_id_number': None,
        'extracted_fields': None,
        'reasons': []
    }

    # 1. Locate and decode the QR code in a single pass
    qr_box = None
    qr_payload = ''
    target_img = raw_img if raw_img is not None else img_norm
    try:
        import zxingcpp
        barcodes = zxingcpp.read_barcodes(target_img)
        if not barcodes and raw_img is not None:
            barcodes = zxingcpp.read_barcodes(img_norm)
            if barcodes:
                target_img = img_norm
        if barcodes:
            b = barcodes[0]
            pts = [(p.x, p.y) for p in [b.position.top_left, b.position.top_right, b.position.bottom_right, b.position.bottom_left]]
            qr_box = (max(0, min(p[0] for p in pts)), max(p[1] for p in pts),
                      min(target_img.shape[1], max(p[0] for p in pts)), target_img.shape[0])
            if b.text:
                qr_payload = b.text
    except Exception:
        pass

    if not qr_payload:
        qr_res = decode_qr(target_img)
        if not qr_res.get('qr_detected'):
            qr_res = decode_qr(img_norm)
        if qr_res.get('qr_detected'):
            qr_payload = qr_res.get('payload', '')

    results['qr_code_present'] = bool(qr_payload or qr_box is not None)
    if results['qr_code_present']:
        results['qr_data'] = qr_payload[:80]
    else:
        results['reasons'].append("No valid QR code detected in the security code area.")

    # 2. Face portrait (search only the photo side of the card to avoid text false-positives)
    h_t, w_t = target_img.shape[:2]
    face_res = detect_face(target_img[0:int(h_t * 0.8), 0:int(w_t * 0.45)])
    if not face_res.get('face_detected'):
        face_res = detect_face(img_norm[0:int(672 * 0.8), 0:int(1024 * 0.45)])
    if face_res.get('face_detected'):
        results['photo_present'] = True
        results['face_details'] = {
            'face_detected': True,
            'confidence': face_res.get('confidence', 96.0),
            'crop_data_url': face_res.get('crop_data_url', ''),
            'features': face_res.get('features', []),
        }
    else:
        blank = _get_cached_template(BLANK_TEMPLATE_PATH)
        if blank is not None:
            blank_photo = _normalize_image_for_matching(blank)[230:465, 60:255]
            sil_sim = float(cv2.matchTemplate(img_norm[230:465, 60:255], blank_photo, cv2.TM_CCOEFF_NORMED)[0][0])
            results['photo_present'] = sil_sim < 0.92
        else:
            results['photo_present'] = True
    if not results['photo_present']:
        results['reasons'].append("No visible face portrait in the ID photo area.")

    # 3. OSCA ID number under the QR code
    num_present, under_qr_text = _detect_id_number_under_qr(target_img, qr_box=qr_box)
    if not num_present:
        num_present, under_qr_text = _detect_id_number_under_qr(img_norm)

    # 4. Field extraction: OCR primary, QR fallback
    ocr_fields = _extract_fields_from_ocr(ocr_text, under_qr_text if num_present else '', img_norm=img_norm)
    qr_fields = _extract_fields_from_qr(qr_payload)
    extracted = _merge_extracted_fields(ocr_fields, qr_fields)
    results['extracted_fields'] = extracted

    if not num_present and extracted['osca_id']['value']:
        num_present = True
    results['osca_number_present'] = num_present
    results['osca_id_number'] = extracted['osca_id']['value'] or (under_qr_text or None)
    if not num_present:
        results['reasons'].append("OSCA ID number is not clearly visible below the QR code.")

    results['personal_info_populated'] = bool(extracted['name']['value']) and any(
        extracted[k]['value'] for k in ('dob', 'sex', 'civil_status')
    )
    if not results['personal_info_populated']:
        results['reasons'].append("Personal information fields (Name, Date of Birth, Sex/Status) are empty or unreadable.")

    # 5. Residential address: check full-card OCR first; only run region crop OCR if needed
    has_addr = bool(_ADDRESS_RE.search(ocr_text.upper()))
    if not has_addr:
        address_ocr = _extract_ocr_text(img_norm[380:580, 180:650]).upper()
        has_addr = bool(_ADDRESS_RE.search(address_ocr))
    results['address_present'] = has_addr
    if not results['address_present']:
        results['reasons'].append("Residential address details are missing or unreadable.")

    results['passed'] = all(results[k] for k in (
        'personal_info_populated', 'address_present', 'photo_present', 'qr_code_present', 'osca_number_present'
    ))
    return results


def validate_osca_id_two_tier(img_input, applicant_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Two-Tier OSCA ID Template Matching & Validation Pipeline
    """
    raw_img = _load_image(img_input)
    if raw_img is None:
        return {
            'overall_status': 'FAIL',
            'current_stage': 1,
            'stage1': {'passed': False, 'reasons': ['Invalid or unreadable image file.']},
            'stage2': {'passed': False, 'reasons': ['Did not proceed to Stage 2.']},
            'summary_message': 'Could not process uploaded ID image.'
        }

    img_norm = _normalize_image_for_matching(raw_img)
    ocr_text = _extract_ocr_text(img_norm)

    stage1_res = validate_stage1_structure(img_norm, ocr_text)
    if not stage1_res['passed']:
        return {
            'overall_status': 'FAIL',
            'current_stage': 1,
            'stage1': stage1_res,
            'stage2': {
                'passed': False,
                'reasons': ['Stage 1 structural validation failed. Did not proceed to Stage 2.']
            },
            'summary_message': f"Stage 1 Failed: {'; '.join(stage1_res['reasons'])}"
        }

    stage2_res = validate_stage2_content(img_norm, ocr_text, raw_img=raw_img, applicant_data=applicant_data)

    overall_status = 'PASS' if stage2_res['passed'] else 'FAIL'
    summary_message = (
        'OSCA ID Verified: Structure, official logos, personal data, QR code, and ID number are valid.'
        if overall_status == 'PASS'
        else f"Stage 2 Incomplete: {'; '.join(stage2_res['reasons'])}"
    )

    return {
        'overall_status': overall_status,
        'current_stage': 2,
        'stage1': stage1_res,
        'stage2': stage2_res,
        'summary_message': summary_message
    }
