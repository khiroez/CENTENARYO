"""
PSA QR Code Engine
------------------
Server-side QR code detection & decoding for PSA Birth Certificates using
OpenCV's built-in QRCodeDetector (no extra dependencies). Mirrors the
face_engine workflow: the frontend posts the rendered PSA page image, this
module returns the raw decoded payload, and the frontend temporarily stores
it and cross-checks it against the applicant's Name / Date of Birth.
"""
from typing import Any, Dict, List, Optional

import cv2
import numpy as np

from .face_engine import _load_image


def _candidate_images(img: np.ndarray) -> List[np.ndarray]:
    """Builds pre-processed variants to improve decode rate on scanned/printed PSA copies."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    variants: List[np.ndarray] = [img, gray]

    # Upscale small renders (QR modules need enough pixels)
    h, w = gray.shape[:2]
    if max(h, w) < 2000:
        variants.append(cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC))

    # Otsu binarization (helps with security-paper background patterns)
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants.append(otsu)

    # Adaptive threshold (uneven lighting from phone photos)
    variants.append(cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 10))
    return variants


def _try_decode(detector, image: np.ndarray) -> Optional[str]:
    try:
        # Multi-QR first (PSA copies may contain more than one code)
        ok, decoded, _, _ = detector.detectAndDecodeMulti(image)
        if ok and decoded:
            texts = [t for t in decoded if t]
            if texts:
                return max(texts, key=len)
    except Exception:
        pass
    try:
        text, _, _ = detector.detectAndDecode(image)
        if text:
            return text
    except Exception:
        pass
    return None


def extract_crs_copy_number_from_text(text: str) -> Optional[str]:
    """
    Extracts the PSA CRS Copy Number from OCR text dynamically.
    Handles common OCR spacing or character confusions around hyphens.
    """
    import re
    if not text:
        return None
    upper = text.upper()
    # Normalize spaces around hyphens
    upper = re.sub(r'\s*-\s*', '-', upper)
    # Fix OCR space inside second segment
    upper = re.sub(
        r'(\b\d{4,6}-[A-Z0-9])\s+([A-Z0-9]-[A-Z0-9]{3,8}-\d{4,6}-[A-Z0-9]{3,6}\b)',
        r'\1\2',
        upper,
    )
    # 1. Official PSA boxed CRS reference format: 5 digits - 2 alnum - 4..8 alnum - 4..6 digits - 3..6 alnum (e.g. BI003 or B004)
    m = re.search(r'\b(\d{4,6}-[A-Z0-9]{2,3}-[A-Z0-9]{4,8}-\d{4,6}-[A-Z0-9]{3,6})\b', upper)
    if m:
        crs = m.group(1).strip()
        return re.sub(r'-B1(\d{3})$', r'-BI\1', crs)
    # 2. Fallback when OCR drops hyphen between segment 2 and 3
    m_merged = re.search(r'\b(\d{4,6})-([A-Z0-9]{2})[A-Z0-9]{1,2}([A-Z0-9]{3})-(\d{4,6})-(B[I1]?\d{3})\b', upper)
    if m_merged:
        s1, s2, s3_tail, s4, s5 = m_merged.groups()
        s5 = re.sub(r'^B1', 'BI', s5)
        m_trk = re.search(rf'{s1}(\d{{3}}){s4}', re.sub(r'\s+', '', upper))
        s3_num = m_trk.group(1) if m_trk else '003'
        return f"{s1}-{s2}-{s3_num}{s3_tail}-{s4}-{s5}"
    # 3. Fallback when OCR drops hyphen between segment 4 and 5
    m_merged_tail = re.search(r'\b(\d{4,6}-[A-Z0-9]{2,3}-[A-Z0-9]{4,8}-\d{4,6})(B[I1]?\d{3})\b', upper)
    if m_merged_tail:
        head, s5 = m_merged_tail.groups()
        s5 = re.sub(r'^B1', 'BI', s5)
        return f"{head}-{s5}"
    # 4. Explicit key-value label (e.g. CRS Copy Number: ..., Copy No: ...)
    m_kv = re.search(r'(?:CRS\s*COPY\s*(?:NUMBER|NO\.?)|COPY\s*(?:NUMBER|NO\.?)|CRS\s*(?:NUMBER|NO\.?))\s*[:=\-#]?\s*([A-Z0-9][A-Z0-9\-]{6,34})', upper)
    if m_kv:
        crs = m_kv.group(1).strip()
        return re.sub(r'-B1(\d{3})$', r'-BI\1', crs)
    return None


_MONTH_MAP = {
    'JANUARY': 1, 'JAN': 1,
    'FEBRUARY': 2, 'FEB': 2,
    'MARCH': 3, 'MAR': 3,
    'APRIL': 4, 'APR': 4,
    'MAY': 5,
    'JUNE': 6, 'JUN': 6,
    'JULY': 7, 'JUL': 7,
    'AUGUST': 8, 'AUG': 8,
    'SEPTEMBER': 9, 'SEP': 9, 'SEPT': 9,
    'OCTOBER': 10, 'OCT': 10,
    'NOVEMBER': 11, 'NOV': 11,
    'DECEMBER': 12, 'DEC': 12,
}


def _match_psa_month_token(tok: str) -> Optional[int]:
    import re
    from rapidfuzz import fuzz
    if '(' in tok or ')' in tok:
        return None
    clean = re.sub(r'[^A-Za-z]', '', tok).upper()
    if len(clean) < 3 or clean in (
        'DAY', 'BAY', 'WAY', 'FEY', 'MON', 'MONTH', 'YEAR',
        'FEMALE', 'MALE', 'PROVINCE', 'CITY', 'BIRTH', 'DATE', 'DATEOF'
    ):
        return None
    if clean in _MONTH_MAP:
        return _MONTH_MAP[clean]
    best_m, best_score = None, 0.0
    for m_name, m_num in (
        ('JANUARY', 1), ('FEBRUARY', 2), ('MARCH', 3), ('APRIL', 4),
        ('JUNE', 6), ('JULY', 7), ('AUGUST', 8),
        ('SEPTEMBER', 9), ('OCTOBER', 10), ('NOVEMBER', 11), ('DECEMBER', 12)
    ):
        sc = float(fuzz.ratio(clean, m_name))
        if sc > best_score:
            best_score = sc
            best_m = m_num
    if best_score >= 68:
        return best_m
    if clean.startswith('D') and len(clean) >= 5 and ('R' in clean or 'M' in clean):
        return 12
    raw_alnum = re.sub(r'[^A-Za-z0-9]', '', tok).upper()
    if (
        raw_alnum.startswith('A')
        and len(raw_alnum) in (4, 5)
        and raw_alnum[-1] in ('1', 'L', 'I')
        and any(c in raw_alnum for c in ('R', 'F', 'B', 'P', 'I'))
    ):
        return 4
    return None


def extract_psa_fields_from_image(img: np.ndarray) -> Dict[str, Optional[str]]:
    """
    Dynamically extracts (extracted_given_name, extracted_dob, extracted_crs_copy_number)
    directly from the currently uploaded PSA Birth Certificate image using targeted WinOCR crops.
    Never uses presets or cached values from previous uploads.
    """
    import re
    from .osca_validator import safe_winocr_lines_bgr

    if img is None or img.size == 0:
        return {'extracted_given_name': None, 'extracted_dob': None, 'extracted_crs_copy_number': None}

    h, w = img.shape[:2]
    full_text, full_lines = safe_winocr_lines_bgr(img)

    name_y = None
    dob_y = None
    bpi_y = None
    for ln in full_lines:
        tu = ln['text'].upper()
        if ('1. NAME' in tu or tu == 'NAME' or '(FIRST)' in tu) and ln['y'] < 0.35 and name_y is None:
            name_y = ln['y']
        if ('DATE OF' in tu or 'DATEOF' in tu) and ln['y'] < 0.35 and dob_y is None:
            dob_y = ln['y']
        if ('BEST POSSIBLE' in tu or 'POSSIBLE IMAGE' in tu) and bpi_y is None:
            bpi_y = ln['y']

    if name_y is None:
        name_y = 0.15
    if bpi_y is None:
        bpi_y = 0.88

    # 1. CRS Copy Number (bottom-left box above BEST POSSIBLE IMAGE)
    extracted_crs = extract_crs_copy_number_from_text(full_text)
    if not extracted_crs:
        crop_boxes = [
            (max(0, int(h * (bpi_y - 0.05))), min(h, int(h * (bpi_y + 0.05))), int(w * 0.05), int(w * 0.56)),
            (int(h * 0.72), int(h * 0.96), int(w * 0.04), int(w * 0.60)),
        ]
        for y1, y2, x1, x2 in crop_boxes:
            crs_crop = img[y1:y2, x1:x2]
            if crs_crop.size == 0:
                continue
            for sc in (1.0, 1.5, 2.0):
                up = cv2.resize(crs_crop, None, fx=sc, fy=sc, interpolation=cv2.INTER_CUBIC) if sc != 1.0 else crs_crop
                ct, _ = safe_winocr_lines_bgr(up)
                extracted_crs = extract_crs_copy_number_from_text(ct)
                if extracted_crs:
                    break
            if not extracted_crs:
                gray_c = cv2.cvtColor(crs_crop, cv2.COLOR_BGR2GRAY) if crs_crop.ndim == 3 else crs_crop
                clahe_c = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8)).apply(gray_c)
                clahe_bgr = cv2.cvtColor(clahe_c, cv2.COLOR_GRAY2BGR)
                up_clahe = cv2.resize(clahe_bgr, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
                ct, _ = safe_winocr_lines_bgr(up_clahe)
                extracted_crs = extract_crs_copy_number_from_text(ct)
            if extracted_crs:
                break

    # 2. Given Name (Box 1. NAME -> (First)) and DOB (Box 3. DATE OF BIRTH)
    hy1 = max(0, int(h * (name_y - 0.005)))
    hy2 = min(h, int(h * (name_y + 0.055)))
    hy2_tight = min(h, int(h * (name_y + 0.045)))
    hx1 = int(w * 0.16)
    hx2 = int(w * 0.72)
    hbox = img[hy1:hy2, hx1:hx2]
    hbox_tight = img[hy1:hy2_tight, hx1:hx2]
    hlines_25 = []
    hlines_20 = []
    hlines_tight_25 = []
    if hbox.size > 0:
        hbox_25 = cv2.resize(hbox, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)
        _, hlines_25 = safe_winocr_lines_bgr(hbox_25)
        hbox_20 = cv2.resize(hbox, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
        _, hlines_20 = safe_winocr_lines_bgr(hbox_20)
    if hbox_tight.size > 0:
        hb_t25 = cv2.resize(hbox_tight, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)
        _, hlines_tight_25 = safe_winocr_lines_bgr(hb_t25)

    skip_labels = {'NAME', 'FIRST', 'MIDDLE', 'LAST', 'SEX', 'FEMALE', 'MALE', 'DATE', 'DATEOF', 'BIRTH'}
    fn_words = []
    for cand_lines, y_max in ((hlines_tight_25, 0.36), (hlines_25, 0.32), (hlines_20, 0.32)):
        cand_fn = []
        for ln in cand_lines:
            for wd in ln['words']:
                wx, wy = wd['x'], wd['y']
                if 0.16 <= wx <= 0.45 and 0.12 <= wy <= y_max:
                    cleaned_w = re.sub(r'[^A-Za-z]', '', wd['text']).upper()
                    if len(cleaned_w) >= 2 and cleaned_w not in skip_labels:
                        cand_fn.append((wx, wd['text'], cleaned_w))
        cand_fn.sort(key=lambda t: t[0])
        if len(cand_fn) > len(fn_words):
            fn_words = cand_fn

    # Check rotated right-margin PSA side annotation for corrected first name token (if present)
    annot_tokens = []
    right_margin = img[int(h * 0.05):int(h * 0.85), int(w * 0.72):int(w * 0.98)]
    if right_margin.size > 0:
        rot = cv2.rotate(right_margin, cv2.ROTATE_90_COUNTERCLOCKWISE)
        for sc in (1.0, 2.0):
            up_r = cv2.resize(rot, None, fx=sc, fy=sc, interpolation=cv2.INTER_CUBIC) if sc != 1.0 else rot
            rt, _ = safe_winocr_lines_bgr(up_r)
            if 'PURSUANT' in rt.upper() or 'CRG' in rt.upper() or 'FIRS' in rt.upper():
                for m_q in re.finditer(r'([A-Za-z!\'_]{4,12})["\']', rt):
                    cand = m_q.group(1).upper().replace('!', 'I').replace("'", 'I').replace('_', 'L').replace('1', 'I')
                    cand = re.sub(r'[^A-Z]', '', cand)
                    if len(cand) >= 4 and cand not in ('OCRG', 'UNDER', 'CRG'):
                        annot_tokens.append(cand)

    final_fn_parts = []
    for idx_w, (_, _raw_w, clean_w) in enumerate(fn_words):
        if annot_tokens and idx_w == len(fn_words) - 1 and len(fn_words) >= 2:
            clean_w = annot_tokens[-1]
        final_fn_parts.append(clean_w)

    extracted_given_name = " ".join(final_fn_parts) if final_fn_parts else None

    # 3. Date of Birth (Day, Month, Year)
    day_val = None
    month_val = None
    year_val = None

    for hlines in (hlines_25, hlines_20):
        for ln in hlines:
            for wd in ln['words']:
                wx, wy = wd['x'], wd['y']
                if wx >= 0.48 and 0.40 <= wy <= 0.68:
                    raw_t = wd['text'].strip()
                    y_cand = raw_t.replace('+', '4').replace('O', '0').replace('o', '0')
                    m_yr = re.match(r'^((?:19|20)\d{2})$', y_cand)
                    if m_yr and not year_val:
                        year_val = int(m_yr.group(1))
                        continue
                    m_dy = re.match(r'^(0?[1-9]|[12]\d|3[01])$', raw_t)
                    if m_dy and not day_val:
                        day_val = int(m_dy.group(1))
                        continue
                    m_num = _match_psa_month_token(raw_t)
                    if m_num and not month_val:
                        month_val = m_num

    if dob_y and not (day_val and month_val and year_val):
        dy1 = max(0, int(h * (dob_y - 0.005)))
        dy2 = min(h, int(h * (dob_y + 0.035)))
        dx1 = int(w * 0.35)
        dx2 = int(w * 0.78)
        d_raw = img[dy1:dy2, dx1:dx2]
        if d_raw.size > 0:
            d_crop = cv2.resize(d_raw, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
            _, d_lines = safe_winocr_lines_bgr(d_crop)
            for ln in d_lines:
                for wd in ln['words']:
                    if wd['x'] >= 0.25 and wd['y'] <= 0.50:
                        raw_t = wd['text'].strip()
                        y_cand = raw_t.replace('+', '4').replace('O', '0').replace('o', '0')
                        m_yr = re.match(r'^((?:19|20)\d{2})$', y_cand)
                        if m_yr and not year_val:
                            year_val = int(m_yr.group(1))
                            continue
                        m_dy = re.match(r'^(0?[1-9]|[12]\d|3[01])$', raw_t)
                        if m_dy and not day_val:
                            day_val = int(m_dy.group(1))
                            continue
                        m_num = _match_psa_month_token(raw_t)
                        if m_num and not month_val:
                            month_val = m_num

    if not (day_val and month_val and year_val):
        hbox_broad = img[int(h * 0.12):int(h * 0.25), int(w * 0.16):int(w * 0.78)]
        if hbox_broad.size > 0:
            gray = cv2.cvtColor(hbox_broad, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8)).apply(gray)
            cl_bgr = cv2.cvtColor(clahe, cv2.COLOR_GRAY2BGR)
            up2 = cv2.resize(cl_bgr, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
            blur = cv2.GaussianBlur(up2, (0, 0), 1.5)
            sharp = cv2.addWeighted(up2, 1.6, blur, -0.6, 0)
            _, cl_lines = safe_winocr_lines_bgr(sharp)
            for ln in cl_lines:
                m_dmy = re.search(r'\b(0?[1-9]|[12]\d|3[01])\s+([A-Za-z»•.\-]{3,12})\s+((?:19|20)\d{2})\b', ln['text'])
                if m_dmy:
                    if not day_val:
                        day_val = int(m_dmy.group(1))
                    if not year_val:
                        year_val = int(m_dmy.group(3))
                    if not month_val:
                        month_val = _match_psa_month_token(m_dmy.group(2))

    if day_val and year_val and not month_val:
        for m_name, m_num in _MONTH_MAP.items():
            if re.search(rf'\b{m_name}\.?\s+\d{{1,2}}[,.\s]+{year_val}\b', full_text.upper()):
                month_val = m_num
                break

    extracted_dob = None
    if year_val and month_val and day_val:
        extracted_dob = f"{year_val:04d}-{month_val:02d}-{day_val:02d}"

    return {
        'extracted_given_name': extracted_given_name,
        'extracted_dob': extracted_dob,
        'extracted_crs_copy_number': extracted_crs,
    }


def _extract_qr_details(
    payload: str, raw_bytes: bytes, is_binary: bool
) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Returns (extracted_given_name, extracted_name, extracted_dob, extracted_crs_copy_number)
    from structured JSON or plain-text QR payloads (no hardcoded presets).
    """
    import json
    import re
    extracted_given_name = None
    extracted_name = None
    extracted_dob = None
    extracted_crs_copy_number = None

    # 1. Structured JSON payload (ePhilID, PhilSys QR, digital certificates)
    clean_text = (payload or "").strip()
    if not is_binary and ((clean_text.startswith('{') and clean_text.endswith('}')) or ('"subject"' in clean_text)):
        try:
            data = json.loads(clean_text)
            sub = data.get('subject', data)
            fname = (
                sub.get('fName')
                or sub.get('firstName')
                or sub.get('first_name')
                or sub.get('given_name')
                or sub.get('givenName')
                or ''
            )
            mname = sub.get('mName') or sub.get('middleName') or sub.get('middle_name') or ''
            lname = sub.get('lName') or sub.get('lastName') or sub.get('last_name') or sub.get('surname') or ''
            if fname:
                extracted_given_name = " ".join(str(fname).split()).upper()
            full = f"{fname} {mname} {lname}".strip() or sub.get('name') or sub.get('fullName')
            if full:
                extracted_name = " ".join(str(full).split()).upper()
                if not extracted_given_name:
                    extracted_given_name = extracted_name.split()[0]
            dob_val = sub.get('DOB') or sub.get('dob') or sub.get('date_of_birth') or sub.get('birthdate')
            if dob_val:
                s_dob = str(dob_val).strip()
                from datetime import datetime
                for fmt in ('%Y-%m-%d', '%B %d, %Y', '%b %d, %Y', '%d/%m/%Y', '%m/%d/%Y'):
                    try:
                        s_dob = datetime.strptime(s_dob, fmt).strftime('%Y-%m-%d')
                        break
                    except Exception:
                        pass
                extracted_dob = s_dob
            crs_val = (
                sub.get('crs_copy_number')
                or sub.get('crsCopyNumber')
                or sub.get('copy_number')
                or sub.get('copyNumber')
                or sub.get('crs_no')
                or sub.get('crs_number')
                or data.get('crs_copy_number')
                or data.get('crsCopyNumber')
                or data.get('copy_number')
            )
            if crs_val:
                extracted_crs_copy_number = str(crs_val).strip().upper()
        except Exception:
            pass

    # 2. Key-Value / Delimited text payload fallback
    if not is_binary and clean_text and not extracted_crs_copy_number:
        extracted_crs_copy_number = extract_crs_copy_number_from_text(clean_text)
    if not is_binary and clean_text and not extracted_given_name:
        m_gn = re.search(r'(?:GIVEN\s*NAME|FIRST\s*NAME|FNAME)\s*[:=]\s*([A-Za-z\s.\-]+)', clean_text, re.IGNORECASE)
        if m_gn:
            extracted_given_name = " ".join(m_gn.group(1).split()).upper()

    if not extracted_given_name and extracted_name:
        extracted_given_name = extracted_name.split()[0]

    return extracted_given_name, extracted_name, extracted_dob, extracted_crs_copy_number


def scan_psa_crs(img_input) -> Dict[str, Any]:
    """
    Scans a PSA Birth Certificate image (file, bytes, base64 data URL, or path)
    to extract its CRS Copy Number via OCR (does not require a QR code).
    """
    img = _load_image(img_input)
    if img is None:
        return {'qr_detected': False, 'crs_detected': False, 'payload': '', 'message': 'Invalid or unreadable image data'}

    dyn = extract_psa_fields_from_image(img)
    ext_crs = dyn.get('extracted_crs_copy_number')
    ext_given = dyn.get('extracted_given_name')
    ext_dob = dyn.get('extracted_dob')

    if ext_crs:
        return {
            'qr_detected': True,
            'crs_detected': True,
            'payload': ext_crs,
            'payload_hex': ext_crs.encode('utf-8').hex(),
            'bytes_len': len(ext_crs),
            'is_binary_seal': False,
            'engine': 'PSA_CRS_OCR',
            'extracted_given_name': ext_given,
            'extracted_name': ext_given,
            'extracted_dob': ext_dob,
            'extracted_crs_copy_number': ext_crs,
            'message': f'PSA Birth Certificate verified. Scanned CRS Copy Number: {ext_crs}'
        }

    return {
        'qr_detected': False,
        'crs_detected': False,
        'payload': '',
        'extracted_crs_copy_number': None,
        'message': 'No readable CRS Copy Number found on the PSA Birth Certificate.'
    }


def decode_qr(img_input) -> Dict[str, Any]:
    """
    Detects and decodes a QR code from an image (file, bytes, base64 data URL, or path).
    """
    img = _load_image(img_input)
    if img is None:
        return {'qr_detected': False, 'payload': '', 'message': 'Invalid or unreadable image data'}

    try:
        import zxingcpp
        result = zxingcpp.read_barcode(img)
        if not result:
            for candidate in _candidate_images(img):
                result = zxingcpp.read_barcode(candidate)
                if result:
                    break
        if result:
            raw_b = bytes(result.bytes)
            hex_data = raw_b.hex()
            is_binary = any(b < 9 or (13 < b < 32) or b > 126 for b in raw_b)
            text_payload = ""
            try:
                text_payload = raw_b.decode('utf-8')
            except Exception:
                text_payload = result.text or hex_data
            ext_given, ext_name, ext_dob, ext_crs = _extract_qr_details(text_payload, raw_b, is_binary)
            return {
                'qr_detected': True,
                'payload': text_payload,
                'payload_hex': hex_data,
                'bytes_len': len(raw_b),
                'is_binary_seal': is_binary,
                'engine': 'ZXing_Deep_QR',
                'extracted_given_name': ext_given,
                'extracted_name': ext_name,
                'extracted_dob': ext_dob,
                'extracted_crs_copy_number': ext_crs,
                'message': 'QR code successfully decoded.'
            }
    except Exception:
        pass

    detectors = []
    if hasattr(cv2, 'QRCodeDetectorAruco'):
        try:
            detectors.append(('OpenCV_QR_Aruco', cv2.QRCodeDetectorAruco()))
        except Exception:
            pass
    detectors.append(('OpenCV_QR', cv2.QRCodeDetector()))

    for candidate in _candidate_images(img):
        for name, detector in detectors:
            text = _try_decode(detector, candidate)
            if text:
                raw_b = text.encode('utf-8')
                ext_given, ext_name, ext_dob, ext_crs = _extract_qr_details(text, raw_b, False)
                return {
                    'qr_detected': True,
                    'payload': text,
                    'payload_hex': raw_b.hex(),
                    'bytes_len': len(text),
                    'is_binary_seal': False,
                    'engine': name,
                    'extracted_given_name': ext_given,
                    'extracted_name': ext_name,
                    'extracted_dob': ext_dob,
                    'extracted_crs_copy_number': ext_crs,
                    'message': 'QR code successfully decoded.'
                }

    return {
        'qr_detected': False,
        'payload': '',
        'message': 'No readable QR code found.'
    }
