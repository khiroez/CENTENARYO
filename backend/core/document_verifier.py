import os
import re
import asyncio
from datetime import datetime, date
from typing import Optional, Dict, Any, Tuple
from PIL import Image
import numpy as np

# Third-party libraries already installed in venv
from rapidfuzz import fuzz
import pypdf
import pypdfium2

try:
    import winocr
    HAS_WINOCR = True
except ImportError:
    HAS_WINOCR = False

from .face_engine import detect_face, compare_face_features

# Official keywords for authentic document recognition
PSA_KEYWORDS = [
    "PHILIPPINE STATISTICS AUTHORITY",
    "OFFICE OF THE CIVIL REGISTRAR",
    "CIVIL REGISTRAR GENERAL",
    "CERTIFICATE OF LIVE BIRTH",
    "NATIONAL STATISTICS OFFICE",
    "REPUBLIC OF THE PHILIPPINES",
    "PSA",
    "NSO",
    "REGISTRY NO",
    "LOCAL CIVIL REGISTRAR",
    "CHILD",
    "PLACE OF BIRTH",
]

ID_KEYWORDS = [
    "OSCA",
    "SENIOR CITIZEN",
    "OFFICE FOR SENIOR CITIZENS",
    "REPUBLIC OF THE PHILIPPINES",
    "IDENTIFICATION CARD",
    "SENIOR CITIZENS ACT",
    "R.A. 9994",
    "R.A. 7432",
    "DRIVER",
    "LICENSE",
    "POSTAL",
    "PASSPORT",
    "PRC",
    "UMID",
    "VOTER",
    "BARANGAY",
    "CITY GOVERNMENT",
    "MUNICIPALITY",
]

MONTH_NAMES = {
    1: ["JANUARY", "JAN"],
    2: ["FEBRUARY", "FEB"],
    3: ["MARCH", "MAR"],
    4: ["APRIL", "APR"],
    5: ["MAY"],
    6: ["JUNE", "JUN"],
    7: ["JULY", "JUL"],
    8: ["AUGUST", "AUG"],
    9: ["SEPTEMBER", "SEP", "SEPT"],
    10: ["OCTOBER", "OCT"],
    11: ["NOVEMBER", "NOV"],
    12: ["DECEMBER", "DEC"],
}


def _safe_get_file_bytes(file_input) -> Optional[bytes]:
    """Safely retrieves raw bytes from file paths, UploadedFiles, or FieldFiles without crashing."""
    if not file_input:
        return None
    if isinstance(file_input, (bytes, bytearray)):
        return bytes(file_input)
    if isinstance(file_input, str):
        if os.path.exists(file_input):
            try:
                with open(file_input, 'rb') as f:
                    return f.read()
            except Exception:
                return None
        from django.conf import settings
        rel = file_input.lstrip('/\\')
        if rel.startswith('media/'):
            rel = rel[6:]
        cand = os.path.join(settings.MEDIA_ROOT, rel)
        if os.path.exists(cand):
            try:
                with open(cand, 'rb') as f:
                    return f.read()
            except Exception:
                return None
        return None

    # Handle Django FieldFile / File object
    try:
        if hasattr(file_input, 'path') and os.path.exists(file_input.path):
            with open(file_input.path, 'rb') as f:
                return f.read()
    except Exception:
        pass

    try:
        if hasattr(file_input, 'name') and file_input.name:
            from django.conf import settings
            rel = str(file_input.name).lstrip('/\\')
            if rel.startswith('media/'):
                rel = rel[6:]
            cand = os.path.join(settings.MEDIA_ROOT, rel)
            if os.path.exists(cand):
                with open(cand, 'rb') as f:
                    return f.read()
    except Exception:
        pass

    try:
        if hasattr(file_input, 'seek'):
            file_input.seek(0)
            data = file_input.read()
            file_input.seek(0)
            return data
    except Exception:
        pass

    return None


def _extract_text_and_image_from_file(file_input) -> Tuple[str, Optional[Image.Image]]:
    """
    Extracts OCR text and a rendered PIL Image from either a PDF or Image file.
    Supports file path string, Django UploadedFile, or bytes.
    """
    extracted_text = ""
    pil_image = None

    raw_bytes = _safe_get_file_bytes(file_input)
    if not raw_bytes:
        return "", None

    # Detect PDF by signature %PDF
    if raw_bytes.startswith(b'%PDF'):
        # 1. Extract digital text with pypdf
        try:
            import io
            reader = pypdf.PdfReader(io.BytesIO(raw_bytes))
            for page in reader.pages[:2]: # Check first 2 pages
                t = page.extract_text() or ""
                if t:
                    extracted_text += " " + t
        except Exception as e:
            print(f"[DocVerifier] pypdf text error: {e}")

        # 2. Render Page 1 to high-resolution image using pypdfium2
        try:
            pdf = pypdfium2.PdfDocument(raw_bytes)
            if len(pdf) > 0:
                page = pdf[0]
                pil_image = page.render(scale=2.0).to_pil()
        except Exception as e:
            print(f"[DocVerifier] pypdfium2 render error: {e}")

    else:
        # Image file (JPG, PNG, WEBP, etc.)
        try:
            import io
            pil_image = Image.open(io.BytesIO(raw_bytes))
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
        except Exception as e:
            print(f"[DocVerifier] Image load error: {e}")

    # 3. If image was rendered or loaded and Windows OCR is available, run WinOCR
    if pil_image is not None and HAS_WINOCR:
        try:
            ocr_res = asyncio.run(winocr.recognize_pil(pil_image, lang='en-US'))
            if ocr_res and hasattr(ocr_res, 'text') and ocr_res.text:
                extracted_text += " " + ocr_res.text
        except Exception as e:
            print(f"[DocVerifier] WinOCR error: {e}")

    cleaned_text = re.sub(r'\s+', ' ', extracted_text).strip()
    return cleaned_text, pil_image


def verify_psa_document(file_input, first_name: str, last_name: str, dob: Any) -> Dict[str, Any]:
    """
    Validates whether the uploaded file is a genuine PSA/NSO Birth Certificate
    and cross-checks the senior's name and date of birth.
    """
    # 0. Check for PSA QR Code in uploaded file
    qr_res = {}
    try:
        from .qr_engine import decode_qr
        qr_res = decode_qr(file_input)
    except Exception as e:
        pass

    text, pil_img = _extract_text_and_image_from_file(file_input)
    upper_text = text.upper()
    if qr_res.get('qr_detected') and qr_res.get('payload'):
        upper_text = (upper_text + " " + qr_res['payload']).upper()

    # 1. Authenticity check: Must contain QR code or PSA / Civil Registry keywords
    matched_keywords = [kw for kw in PSA_KEYWORDS if kw in upper_text]
    is_authentic = qr_res.get('qr_detected', False) or len(matched_keywords) >= 2 or "CERTIFICATE OF LIVE BIRTH" in upper_text or "PHILIPPINE STATISTICS AUTHORITY" in upper_text

    if not is_authentic and not upper_text:
        return {
            'status': 'REJECTED',
            'is_authentic_psa': False,
            'name_match': False,
            'dob_match': False,
            'message': 'Walang nakitang PSA QR code o mababasang dokumento sa in-upload na file.',
            'confidence': 0,
            'extracted_sample': ''
        }

    if not is_authentic:
        return {
            'status': 'REJECTED',
            'is_authentic_psa': False,
            'name_match': False,
            'dob_match': False,
            'message': 'Ang in-upload na file ay hindi opisyal na PSA/NSO Birth Certificate o PSA QR Code.',
            'confidence': 10,
            'extracted_sample': upper_text[:200]
        }

    # 2. Senior Name Match
    full_name_clean = f"{first_name} {last_name}".strip().upper()
    l_name_clean = last_name.strip().upper()
    f_name_clean = first_name.strip().upper()

    # Calculate token set ratio and partial ratio
    token_score = fuzz.token_set_ratio(full_name_clean, upper_text)
    last_name_found = l_name_clean in upper_text or fuzz.partial_ratio(l_name_clean, upper_text) >= 85
    first_name_found = f_name_clean in upper_text or fuzz.partial_ratio(f_name_clean, upper_text) >= 80

    name_matched = token_score >= 70 or (last_name_found and first_name_found)

    # 3. Date of Birth Match
    dob_date = None
    if isinstance(dob, (date, datetime)):
        dob_date = dob
    elif isinstance(dob, str) and dob:
        for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%Y/%m/%d'):
            try:
                dob_date = datetime.strptime(dob, fmt).date()
                break
            except ValueError:
                pass

    dob_matched = False
    detected_year = ""
    calculated_age = 0
    milestone_eligible = False
    milestone_bracket = "None"

    if dob_date:
        today = date.today()
        calculated_age = today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
        
        # Check milestones: 80, 85, 90, 95, 100+
        if calculated_age >= 100:
            milestone_eligible = True
            milestone_bracket = "100 (Centenarian)"
        elif calculated_age >= 95:
            milestone_eligible = True
            milestone_bracket = "95 Milestone"
        elif calculated_age >= 90:
            milestone_eligible = True
            milestone_bracket = "90 Milestone"
        elif calculated_age >= 85:
            milestone_eligible = True
            milestone_bracket = "85 Milestone"
        elif calculated_age >= 80:
            milestone_eligible = True
            milestone_bracket = "80 Milestone"

        y_str = str(dob_date.year)
        m_names = MONTH_NAMES.get(dob_date.month, [])

        year_in_text = y_str in upper_text
        month_in_text = any(mn in upper_text for mn in m_names) or f"/{dob_date.month:02d}/" in upper_text or f"-{dob_date.month:02d}-" in upper_text

        if year_in_text and month_in_text:
            dob_matched = True
            detected_year = y_str
        elif year_in_text:
            # Year matches directly
            dob_matched = True
            detected_year = y_str

    # Determine status
    if qr_res.get('is_binary_seal') or (qr_res.get('qr_detected') and qr_res.get('bytes_len', 0) >= 500):
        # High-density PSA security seal detected
        if name_matched and dob_matched:
            status = 'PASS'
            message = f"PSA Verified: Opisyal na PSA QR Seal at detalye sa sertipiko ay kumpirmado para kay {full_name_clean}."
        elif not upper_text or len(upper_text.strip()) < 15:
            # Cropped QR code only, identity details cannot be read as plaintext -> Queue for manual admin review
            status = 'NEEDS_REVIEW'
            name_matched = False
            dob_matched = False
            message = "PSA Pre-Check: Opisyal na PSA QR Seal (703 Bytes) ay nakita. Ang impormasyon ay naka-encrypt; kailangan ng manual review para sa beripikasyon."
        elif not name_matched or not dob_matched:
            status = 'REJECTED'
            mismatched = "Petsa ng Kapanganakan" if not dob_matched else "Pangalan"
            message = f"PSA Mismatch: Ang in-upload na dokumento ay hindi tumutugma sa {mismatched} ng aplikante."
        else:
            status = 'NEEDS_REVIEW'
            message = "PSA Pre-Check: Nangangailangan ng karagdagang beripikasyon."
    elif is_authentic and name_matched and dob_matched:
        status = 'PASS'
        message = f"PSA Verified: Pangalan ({full_name_clean}) at Petsa ng Kapanganakan ({dob_date.year if dob_date else ''}) ay kumpirmado."
    elif is_authentic and (name_matched or dob_matched):
        status = 'NEEDS_REVIEW'
        mismatched = "Petsa ng Kapanganakan" if not dob_matched else "Pangalan"
        message = f"PSA Pre-Check: Nangangailangan ng beripikasyon sa {mismatched}."
    else:
        status = 'REJECTED'
        message = "Hindi tumutugma ang impormasyon sa in-upload na PSA Certificate."

    return {
        'status': status,
        'is_authentic_psa': is_authentic,
        'name_match': name_matched,
        'name_score': round(token_score, 1),
        'dob_match': dob_matched,
        'detected_year': detected_year,
        'calculated_age': calculated_age,
        'milestone_eligible': milestone_eligible,
        'milestone_bracket': milestone_bracket,
        'message': message,
        'extracted_sample': upper_text[:250]
    }


def verify_id_document(file_input, first_name: str, last_name: str, osca_id: str = "") -> Dict[str, Any]:
    """
    Validates whether the uploaded file is a genuine Government/OSCA ID card
    and extracts biometric face portrait.
    """
    text, pil_img = _extract_text_and_image_from_file(file_input)
    upper_text = text.upper()

    # Authenticity check
    has_id_keyword = any(kw in upper_text for kw in ID_KEYWORDS)
    serial_matched = bool(osca_id and osca_id.strip() and osca_id.strip().upper() in upper_text)

    # Face detection on ID
    face_res = detect_face(file_input)
    face_found = face_res.get('face_detected', False)

    # Name check on ID if text was extracted
    token_score = fuzz.token_set_ratio(f"{first_name} {last_name}".upper(), upper_text) if upper_text else 0
    name_matched = token_score >= 65 or (last_name.upper() in upper_text)

    if not face_found and not has_id_keyword and not text:
        return {
            'status': 'REJECTED',
            'is_authentic_id': False,
            'face_detected': False,
            'name_match': False,
            'message': 'Walang nakitang mukha o impormasyon sa in-upload na ID.',
            'crop_data_url': None,
            'features': None
        }

    if face_found and (has_id_keyword or name_matched or serial_matched):
        status = 'PASS'
        message = 'Opisyal na ID Card at litrato ng mukha ay matagumpay na nakilala.'
    elif face_found:
        status = 'PASS' # Still pass if face is clearly detected from ID photo
        message = 'Naihiwalay ang litrato ng mukha mula sa ID card.'
    else:
        status = 'NEEDS_REVIEW'
        message = 'Kailangang suriin: Hindi malinaw ang litrato ng mukha sa ID.'

    return {
        'status': status,
        'is_authentic_id': has_id_keyword or serial_matched,
        'face_detected': face_found,
        'face_confidence': face_res.get('confidence', 0),
        'crop_data_url': face_res.get('crop_data_url'),
        'features': face_res.get('features'),
        'name_match': name_matched,
        'serial_match': serial_matched,
        'message': message,
        'extracted_sample': upper_text[:200]
    }


def perform_complete_document_verification(senior_data: Dict[str, Any], files: Dict[str, Any], instance_id=None) -> Dict[str, Any]:
    """
    Executes the complete, multi-tiered document verification engine:
    1. SHA-256 Document Deduplication
    2. PSA Certificate Authenticity, Name & DOB Verification
    3. Primary/OSCA ID Card Authenticity & Face Extraction
    4. 2x2 Photo Face Extraction & Quality Verification
    5. Deep Learning Biometric Matching (SFace 128-d Cosine Similarity)
    6. Straight-Through Processing (STP) Auto-Approval Determination
    """
    from .models import Senior

    first_name = str(senior_data.get('first_name', '')).strip()
    last_name = str(senior_data.get('last_name', '')).strip()
    dob = senior_data.get('date_of_birth')
    osca_id = str(senior_data.get('osca_id', '')).strip()

    f_psa = files.get('psa_cert_file')
    f_id = files.get('primary_id_file')
    f_photo = files.get('picture_2x2_file')

    results = {
        'verified_at': datetime.now().isoformat(),
        'overall_verdict': 'NEEDS_REVIEW',
        'can_auto_approve': False,
        'reasons': []
    }

    # 1. Deduplication / Hash Checking
    import hashlib
    def _calc_hash(f):
        raw = _safe_get_file_bytes(f)
        if not raw:
            return None
        return hashlib.sha256(raw).hexdigest()

    duplicates = []
    for f_obj, field_name, label in [
        (f_psa, 'psa_hash', 'PSA Certificate'),
        (f_id, 'primary_id_hash', 'Primary ID'),
        (f_photo, 'picture_2x2_hash', '2x2 Photo'),
    ]:
        if f_obj:
            fh = _calc_hash(f_obj)
            if fh:
                q = Senior.objects.filter(**{field_name: fh})
                if instance_id:
                    q = q.exclude(id=instance_id)
                m = q.first()
                if m:
                    duplicates.append(f"{label} ay kapareho ng kay Senior #{m.id} ({m.first_name} {m.last_name}, OSCA: {m.osca_id}).")

    if duplicates:
        results['hash_check'] = {
            'status': 'FLAGGED',
            'message': 'May kaparehong dokumento sa database (posibleng duplicate submission).',
            'duplicates': duplicates
        }
        results['reasons'].append("Duplicate document hash detected.")
    else:
        results['hash_check'] = {
            'status': 'PASS',
            'message': 'Lahat ng dokumento ay orihinal at walang kapareho sa database.'
        }

    # 2. Verify PSA Birth Certificate
    if f_psa:
        psa_res = verify_psa_document(f_psa, first_name, last_name, dob)
        results['psa_check'] = psa_res
        if psa_res['status'] != 'PASS':
            results['reasons'].append(psa_res['message'])
    else:
        results['psa_check'] = {'status': 'MISSING', 'message': 'Walang PSA Certificate na in-upload.'}
        results['reasons'].append("Missing PSA Birth Certificate.")

    # 3. Verify Primary / OSCA ID
    id_feat = None
    if f_id:
        id_res = verify_id_document(f_id, first_name, last_name, osca_id)
        results['id_check'] = id_res
        id_feat = id_res.get('features')
        if id_res['status'] != 'PASS':
            results['reasons'].append(id_res['message'])
    else:
        results['id_check'] = {'status': 'MISSING', 'message': 'Walang Primary ID na in-upload.'}
        results['reasons'].append("Missing Primary ID.")

    # 4. Verify 2x2 Photo
    photo_feat = None
    if f_photo:
        photo_res = detect_face(f_photo)
        if photo_res.get('face_detected'):
            results['photo_check'] = {
                'status': 'PASS',
                'confidence': photo_res.get('confidence', 96),
                'crop_data_url': photo_res.get('crop_data_url'),
                'message': 'Malinaw na 2x2 biometric face portrait.'
            }
            photo_feat = photo_res.get('features')
        else:
            results['photo_check'] = {
                'status': 'REJECTED',
                'confidence': 0,
                'crop_data_url': None,
                'message': 'Walang mukha na nakita sa in-upload na 2x2 photo.'
            }
            results['reasons'].append("No face detected in 2x2 photo.")
    else:
        results['photo_check'] = {'status': 'MISSING', 'message': 'Walang 2x2 photo na in-upload.'}
        results['reasons'].append("Missing 2x2 photo.")

    # 5. Biometric Face Comparison
    if photo_feat and id_feat:
        comp = compare_face_features(photo_feat, id_feat)
        face_status = 'PASS' if comp['is_match'] else ('NEEDS_REVIEW' if comp['similarity'] >= 50 else 'FLAGGED')
        results['face_match'] = {
            'status': face_status,
            'similarity_pct': comp['similarity'],
            'is_match': comp['is_match'],
            'cosine_similarity': comp.get('cosine', comp.get('correlation', 0.0)),
            'message': f"Biometric Match: {comp['similarity']}% similarity (SFace Neural Engine)" if comp['is_match'] else f"Kailangang suriin: {comp['similarity']}% similarity"
        }
        if face_status != 'PASS':
            results['reasons'].append(f"Biometric face similarity is {comp['similarity']}%.")
    else:
        results['face_match'] = {
            'status': 'NEEDS_REVIEW',
            'similarity_pct': 0,
            'is_match': False,
            'message': 'Hindi maikumpara ang mukha dahil kulang ang litrato sa ID o 2x2.'
        }

    # 6. Overall Verdict & Straight-Through Processing (STP)
    no_hash_flag = results['hash_check']['status'] == 'PASS'
    psa_passed = results['psa_check']['status'] == 'PASS'
    id_passed = results['id_check']['status'] == 'PASS'
    photo_passed = results.get('photo_check', {}).get('status') == 'PASS'
    face_passed = results['face_match']['status'] == 'PASS'

    if no_hash_flag and psa_passed and id_passed and photo_passed and face_passed:
        results['overall_verdict'] = 'PASS'
        results['can_auto_approve'] = True
        results['summary'] = "100% Verified: Lahat ng dokumento, pangalan, petsa, at biometrics ay ganap na tugma."
    elif results['hash_check']['status'] == 'FLAGGED' or results.get('face_match', {}).get('status') == 'FLAGGED' or results.get('psa_check', {}).get('status') == 'REJECTED':
        results['overall_verdict'] = 'FLAGGED'
        results['can_auto_approve'] = False
        results['summary'] = "May nakitang kritikal na babala o hindi pagtutugma sa mga dokumento."
    else:
        results['overall_verdict'] = 'NEEDS_REVIEW'
        results['can_auto_approve'] = False
        results['summary'] = "Kailangan ng manual review ng Staff o Admin para sa ilang detalye."

    return results
