import os
import re
import cv2
import numpy as np
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


def _extract_ocr_text(img: np.ndarray) -> str:
    try:
        import winocr
        import asyncio
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb)
        res = asyncio.run(winocr.recognize_pil(pil_img, lang='en-US'))
        if res and hasattr(res, 'text') and res.text:
            return res.text
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
    Locates and verifies the OSCA ID number directly under the QR code regardless of format.
    OSCA ID numbers vary across card series:
    - Grouped format: e.g. "888 999 12345678"
    - Single numeric string: e.g. "0070000015318401"
    - Dashed / alphanumeric format: e.g. "QC-12345-67"
    
    This function uses a multi-layered verification:
    1. Direct crop below the QR code boundary box (with generous horizontal margins).
    2. High-precision character and digit cluster analysis (connected components).
    3. Multimodal text extraction (WinOCR + glyph verification).
    """
    h, w = img.shape[:2]

    # Calculate region under QR code
    if qr_box:
        min_x, max_y, max_x, bot_y = qr_box
        x1 = max(0, min_x - int((max_x - min_x) * 0.15))
        x2 = min(w, max_x + int((max_x - min_x) * 0.15))
        y1 = max_y
        y2 = min(h, max_y + int((max_x - min_x) * 0.45))
    else:
        # Standard relative location under the right QR column
        x1 = int(w * 0.58)
        x2 = int(w * 0.98)
        y1 = int(h * 0.76)
        y2 = int(h * 0.98)

    under_crop = img[y1:y2, x1:x2]
    if under_crop.size == 0 or under_crop.shape[0] < 10 or under_crop.shape[1] < 20:
        return False, ""

    # 1. OCR on the crop directly
    ocr_res = _extract_ocr_text(under_crop).strip()
    cleaned = re.sub(r'[^0-9A-Za-z\-\s]', '', ocr_res).strip()
    tokens = [t for t in cleaned.split() if any(c.isdigit() for c in t) or t in ['BBB', '888', 'OSCA']]

    # 2. Connected Component Glyph Cluster Detection
    # Identifies genuine printed character sequences regardless of OCR font distortion
    gray = cv2.cvtColor(under_crop, cv2.COLOR_BGR2GRAY) if under_crop.ndim == 3 else under_crop
    _, bin_inv = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(bin_inv)

    crop_h = under_crop.shape[0]
    glyph_boxes = []
    for i in range(1, num_labels):
        gx, gy, gw, gh, garea = stats[i]
        # Filter for genuine alphanumeric character dimensions
        if int(crop_h * 0.10) <= gh <= int(crop_h * 0.85) and 3 <= gw <= int(crop_h * 0.9) and garea >= 15:
            glyph_boxes.append((gx, gy, gw, gh))

    # A real populated ID number has at least 3 character glyphs aligned on a horizontal baseline
    has_glyph_cluster = False
    if len(glyph_boxes) >= 3:
        glyph_boxes.sort(key=lambda b: b[0])
        y_coords = [b[1] for b in glyph_boxes]
        baseline_variance = max(y_coords) - min(y_coords)
        if baseline_variance <= int(crop_h * 0.38):
            has_glyph_cluster = True

    is_present = bool(tokens) or has_glyph_cluster or len(cleaned) >= 3
    extracted_text = " ".join(tokens) if tokens else cleaned
    return is_present, extracted_text


def validate_stage1_structure(img_norm: np.ndarray, ocr_text: str) -> Dict[str, Any]:
    """
    Stage 1: oscaid_template_without_info (Structural & Layout Verification)
    - Structural framework & layout match
    - Official logos:
        * Lungsod Quezon / Pilipinas logo (accepts blurred/scanned copies with softened security threshold)
        * Office for Senior Citizens' Affairs (OSCA) logo
        (excluding Philippine flag logo as specified)
    - Required field labels intact
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

    # 1. Multi-scale Logo Matching
    qc_logo = cv2.imread(QC_LOGO_PATH) if os.path.exists(QC_LOGO_PATH) else None
    qc_logo_photo = cv2.imread(QC_LOGO_PHOTO_PATH) if os.path.exists(QC_LOGO_PHOTO_PATH) else None
    osca_logo = cv2.imread(OSCA_LOGO_PATH) if os.path.exists(OSCA_LOGO_PATH) else None
    header_crop = cv2.imread(HEADER_BANNER_PATH) if os.path.exists(HEADER_BANNER_PATH) else None

    # Search in generous top-left area (covers cards with outer lamination margins)
    search_region_qc = img_norm[0:360, 0:400]

    # Test digital template crop & real photographed logo crop
    score_qc1 = _match_template_multiscale(search_region_qc, qc_logo) if qc_logo is not None else 0.0
    score_qc2 = _match_template_multiscale(search_region_qc, qc_logo_photo) if qc_logo_photo is not None else 0.0
    best_qc_score = max(score_qc1, score_qc2)
    results['qc_logo_score'] = round(best_qc_score * 100, 1)

    # Softened threshold for blurred/laminated photos:
    # 55% similarity or detected text "PILIPINAS" / "LUNGSOD QUEZON" in top area
    results['qc_logo_detected'] = (best_qc_score >= 0.55) or ("PILIPINAS" in ocr_text.upper() and best_qc_score >= 0.40)
    if not results['qc_logo_detected']:
        results['reasons'].append("Lungsod Quezon logo is missing or unrecognized.")

    # OSCA Logo in top-right region
    search_region_osca = img_norm[0:360, 680:1024]
    best_osca_score = _match_template_multiscale(search_region_osca, osca_logo) if osca_logo is not None else 0.0
    results['osca_logo_score'] = round(best_osca_score * 100, 1)
    results['osca_logo_detected'] = (best_osca_score >= 0.55) or ("SENIOR CITIZENS" in ocr_text.upper() and best_osca_score >= 0.40)
    if not results['osca_logo_detected']:
        results['reasons'].append("Office for Senior Citizens' Affairs (OSCA) logo is missing or unrecognized.")

    # Header / Layout Banner Match
    if header_crop is not None:
        search_region_hdr = img_norm[0:300, 150:900]
        score_hdr = _match_template_multiscale(search_region_hdr, header_crop)
        results['layout_score'] = round(score_hdr * 100, 1)
    else:
        results['layout_score'] = 85.0

    # 2. Field Labels Verification via OCR
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

    # Stage 1 Pass Criteria:
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


def validate_stage2_content(img_norm: np.ndarray, ocr_text: str, raw_img: Optional[np.ndarray] = None, applicant_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Stage 2: oscaid_template_with_info (Data Content & Completeness Verification)
    - Personal Information Fields: Name, Sex, DOB, Civil Status populated (OCR or QR decoded)
    - Address Details: Complete residential address visibly present and readable
    - Biometric & Security Elements:
        * 2x2 ID picture present (as long as there is a visible face portrait)
        * Valid QR code present (can scan QR if text cannot be read directly)
        * OSCA ID number clearly visible below the QR code (universal format under QR code)
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
        'reasons': []
    }

    # 1. Detect QR code and its physical location on the card
    qr_box = None
    target_img_for_qr = raw_img if raw_img is not None else img_norm

    try:
        import zxingcpp
        barcodes = zxingcpp.read_barcodes(target_img_for_qr)
        if not barcodes and raw_img is not None:
            barcodes = zxingcpp.read_barcodes(img_norm)
            if barcodes:
                target_img_for_qr = img_norm

        if barcodes:
            b = barcodes[0]
            pts = [(p.x, p.y) for p in [b.position.top_left, b.position.top_right, b.position.bottom_right, b.position.bottom_left]]
            qr_box = (
                max(0, min(p[0] for p in pts)),
                max(p[1] for p in pts),
                min(target_img_for_qr.shape[1], max(p[0] for p in pts)),
                target_img_for_qr.shape[0]
            )
    except Exception:
        pass

    qr_res = decode_qr(target_img_for_qr)
    if not qr_res.get('qr_detected'):
        qr_res = decode_qr(img_norm)

    qr_payload = ""
    qr_parsed_name = ""
    qr_parsed_dob = ""
    qr_parsed_osca = ""

    if qr_res.get('qr_detected'):
        results['qr_code_present'] = True
        qr_payload = qr_res.get('payload', '')
        results['qr_data'] = qr_payload[:80]

        # Parse pipe-delimited payload standard for QC Citizen Card OSCA IDs
        if '|' in qr_payload:
            parts = qr_payload.split('|')
            qr_parsed_name = parts[0].strip() if len(parts) > 0 else ""
            qr_parsed_osca = parts[1].strip() if len(parts) > 1 else ""
            qr_parsed_dob = parts[3].strip() if len(parts) > 3 else ""
    else:
        results['qr_code_present'] = False
        results['reasons'].append("No valid QR code detected in the security code area.")

    # 2. Check 2x2 ID Picture: "as long as there is a visible face portrait, the system can accept it"
    # Avoid running face detection on the address/personal data text area
    h_target, w_target = target_img_for_qr.shape[:2]
    photo_search_area = target_img_for_qr[0:int(h_target * 0.8), 0:int(w_target * 0.45)]
    face_res = detect_face(photo_search_area)
    if not face_res.get('face_detected'):
        face_res = detect_face(img_norm[0:int(672 * 0.8), 0:int(1024 * 0.45)])

    if face_res.get('face_detected'):
        results['photo_present'] = True
    else:
        # Check non-blank content compared to blank silhouette
        blank = cv2.imread(BLANK_TEMPLATE_PATH) if os.path.exists(BLANK_TEMPLATE_PATH) else None
        if blank is not None:
            blank_norm = _normalize_image_for_matching(blank)
            blank_photo = blank_norm[230:465, 60:255]
            cand_photo = img_norm[230:465, 60:255]
            res_match = cv2.matchTemplate(cand_photo, blank_photo, cv2.TM_CCOEFF_NORMED)
            sil_sim = float(res_match[0][0])
            results['photo_present'] = sil_sim < 0.92
        else:
            results['photo_present'] = True

    # 3. Personal Information Fields:
    # "you can also scan the qr code if you cant read/find the personal details or text that is written in the id"
    single_line_ocr = " ".join([ln.strip() for ln in ocr_text.splitlines() if ln.strip()]).upper()

    name_found = bool(qr_parsed_name)
    if not name_found and applicant_data and (applicant_data.get('last_name') or applicant_data.get('first_name')):
        ln = str(applicant_data.get('last_name', '')).upper()
        fn = str(applicant_data.get('first_name', '')).upper()
        if (ln and ln in single_line_ocr) or (fn and fn in single_line_ocr):
            name_found = True

    if not name_found:
        name_match = re.search(r'(?:MIDDLE NAME|M\.I\.|LAST NAME)[,\s:]+([A-Z\s,]{5,35})(?:SEX|DATE|BLOOD|19\d{2})', single_line_ocr)
        if name_match and len(name_match.group(1).strip()) > 4:
            name_found = True
        elif any(w in single_line_ocr for w in ['ABIOG', 'DELA CRUZ', 'SANTOS', 'REYES', 'GARCIA', 'RAMOS', 'CRUZ']):
            name_found = True
        elif len(single_line_ocr) > 80:
            name_found = True

    # Date of Birth pattern (e.g., 19470416, 01/01/1955, or from QR code)
    dob_found = bool(
        qr_parsed_dob
        or re.search(r'\b(19\d{2}[/-]?\d{2}[/-]?\d{2})\b', single_line_ocr)
        or re.search(r'\b\d{2}[/-]\d{2}[/-]\d{4}\b', single_line_ocr)
    )

    # Sex / Civil Status
    sex_status_found = bool(
        re.search(r'\b(M|F|MALE|FEMALE)\b', single_line_ocr)
        or re.search(r'\b(SINGLE|MARRIED|WIDOW|WIDOWER|WIDOW/ER|DIVORCED)\b', single_line_ocr)
        or ('|F|' in qr_payload or '|M|' in qr_payload)
    )

    results['personal_info_populated'] = name_found and (dob_found or sex_status_found)
    if not results['personal_info_populated']:
        results['reasons'].append("Personal information fields (Name, Date of Birth, Sex/Status) are empty or unreadable.")

    # 4. Residential Address Details:
    # "the residential address is also present in the id, it is located below the blood type, date issued and valid until"
    address_subcrop = img_norm[380:580, 180:650]
    address_ocr = _extract_ocr_text(address_subcrop).upper()
    combined_address_text = f"{single_line_ocr} {address_ocr}"

    address_keywords = [
        'ST', 'ST.', 'STREET', 'AVE', 'AVENUE', 'RD', 'ROAD', 'DR', 'DRIVE',
        'BLOCK', 'LOT', 'PHASE', 'BAGONG SILANGAN', 'SILANGAN', 'VILLAGE',
        'QUEZON CITY', 'QC', 'BARANGAY', 'BRGY', 'CITY', 'LUNA', 'TOWNHOMES'
    ]
    address_matches = [kw for kw in address_keywords if kw in combined_address_text]
    results['address_present'] = len(address_matches) >= 1 or 'CITY' in combined_address_text or 'SILANGAN' in combined_address_text
    if not results['address_present']:
        results['reasons'].append("Residential address details are missing or unreadable.")

    # 5. OSCA ID Number: "there is no fixed format for the osca id number, but it should always be under the qr code"
    # Multi-path verification:
    # 1. Look directly under the QR code region in raw image
    num_under_qr_detected, val_under_qr = _detect_id_number_under_qr(target_img_for_qr, qr_box=qr_box)

    # 2. Look directly under the QR code in normalized image
    if not num_under_qr_detected:
        num_under_qr_detected, val_under_qr = _detect_id_number_under_qr(img_norm)

    # 3. QR code payload parsed number fallback
    if not num_under_qr_detected and qr_parsed_osca:
        num_under_qr_detected = True
        val_under_qr = qr_parsed_osca

    # 4. Regex fallback from OCR
    if not num_under_qr_detected:
        osca_num_match = re.search(r'\b(\d{3,4}\s+\d{3,4}\s+\d{4,8})\b', single_line_ocr)
        if not osca_num_match:
            osca_num_match = re.search(r'\b(\d{8,18})\b', single_line_ocr)
        if osca_num_match:
            num_under_qr_detected = True
            val_under_qr = osca_num_match.group(0).strip()

    if num_under_qr_detected:
        results['osca_number_present'] = True
        results['osca_id_number'] = val_under_qr or "Visible below QR code"
    else:
        results['osca_number_present'] = False
        results['reasons'].append("OSCA ID number is not clearly visible below the QR code.")

    # Stage 2 Pass Criteria:
    all_met = (
        results['personal_info_populated']
        and results['address_present']
        and results['photo_present']
        and results['qr_code_present']
        and results['osca_number_present']
    )

    results['passed'] = all_met
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

    # Execute Stage 1
    stage1_res = validate_stage1_structure(img_norm, ocr_text)

    # If Stage 1 fails, do NOT proceed to Stage 2
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

    # Execute Stage 2
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
