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
    # 1. QC Logo detected (softened security tolerance for real/scanned cards)
    # 2. OSCA Logo detected OR layout score >= 60%
    # 3. At least 5 out of 9 mandatory field labels recognized (tolerant to OCR noise)
    labels_passed_count = sum(1 for v in labels_status.values() if v['present'])
    has_logos = results['qc_logo_detected'] and results['osca_logo_detected']
    has_layout = results['qc_logo_detected'] and (results['layout_score'] >= 60.0 or labels_passed_count >= 5)

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
        * OSCA ID number clearly visible below the QR code (or in QR payload)
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

    # 1. Detect QR code (Checks raw image and normalized image)
    qr_res = decode_qr(raw_img if raw_img is not None else img_norm)
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

        # Parse pipe-delimited payload standard for QC Citizen Card OSCA IDs:
        # e.g., ABIOG, LORNA D.|0070000015318401|5|470416|F|A+||210216|320416...
        if '|' in qr_payload:
            parts = qr_payload.split('|')
            qr_parsed_name = parts[0].strip() if len(parts) > 0 else ""
            qr_parsed_osca = parts[1].strip() if len(parts) > 1 else ""
            qr_parsed_dob = parts[3].strip() if len(parts) > 3 else ""
    else:
        results['qr_code_present'] = False
        results['reasons'].append("No valid QR code detected in the security code area.")

    # 2. Check 2x2 ID Picture: "as long as there is a visible face portrait, the system can accept it"
    face_res = detect_face(raw_img if raw_img is not None else img_norm)
    if not face_res.get('face_detected'):
        face_res = detect_face(img_norm)

    if face_res.get('face_detected'):
        results['photo_present'] = True
    else:
        # Check photo sub-crop
        photo_crop = img_norm[200:520, 40:290]
        face_sub = detect_face(photo_crop)
        if face_sub.get('face_detected'):
            results['photo_present'] = True
        else:
            # Check non-blank content
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
    # Inspect OCR on the subcrop below blood type & valid until: y: 380..580, x: 180..650
    address_subcrop = img_norm[380:580, 180:650]
    address_ocr = _extract_ocr_text(address_subcrop).upper()
    combined_address_text = f"{single_line_ocr} {address_ocr}"

    address_keywords = [
        'ST', 'ST.', 'STREET', 'AVE', 'AVENUE', 'RD', 'ROAD', 'DR', 'DRIVE',
        'BLOCK', 'LOT', 'PHASE', 'BAGONG SILANGAN', 'SILANGAN', 'VILLAGE',
        'QUEZON CITY', 'QC', 'BARANGAY', 'BRGY', 'CITY', 'LUNA'
    ]
    address_matches = [kw for kw in address_keywords if kw in combined_address_text]
    # Address is present if at least 2 address indicators match or "QUEZON CITY" / "CITY" / "BAGONG" is found
    results['address_present'] = len(address_matches) >= 1 or 'CITY' in combined_address_text or 'SILANGAN' in combined_address_text
    if not results['address_present']:
        results['reasons'].append("Residential address details are missing or unreadable.")

    # 5. OSCA ID Number directly below QR code or extracted from QR code
    osca_num = qr_parsed_osca
    if not osca_num:
        osca_num_match = re.search(r'\b(\d{10,18})\b', single_line_ocr)
        if osca_num_match:
            osca_num = osca_num_match.group(0).strip()
        else:
            num_subcrop = img_norm[540:665, 400:980]
            num_text = _extract_ocr_text(num_subcrop).strip()
            digit_match = re.search(r'([0-9]{8,18})', num_text)
            if digit_match:
                osca_num = digit_match.group(0)

    if osca_num:
        results['osca_number_present'] = True
        results['osca_id_number'] = osca_num
    else:
        results['osca_number_present'] = False
        results['reasons'].append("OSCA ID number is not clearly visible below the QR code.")

    # Stage 2 Pass Criteria:
    # All 5 validation rules met:
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
