from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view, permission_classes, authentication_classes, action
from rest_framework.permissions import IsAuthenticated, BasePermission, AllowAny
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from .models import Senior, Disbursement, AuditLog, AnomalyFlag, UserProfile, ReviewLog
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import SeniorSerializer, DisbursementSerializer, AuditLogSerializer, AnomalyFlagSerializer, ReviewLogSerializer

class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Subclass ng TokenObtainPairView para mag-log ng LOGIN action sa AuditLog
    sa tuwing may matagumpay na login (JWT token generation).
    """
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            username = request.data.get('username')
            from django.contrib.auth.models import User
            try:
                user = User.objects.get(username=username)
                
                # Alamin ang IP address ng kliente
                x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
                if x_forwarded_for:
                    ip = x_forwarded_for.split(',')[0]
                else:
                    ip = request.META.get('REMOTE_ADDR')
                
                AuditLog.objects.create(
                    user=user,
                    action='LOGIN',
                    target_model='User',
                    target_object_id=str(user.id),
                    changes_summary=f"User {user.username} logged in successfully.",
                    ip_address=ip
                )
            except User.DoesNotExist:
                pass
        return response


class IsAdmin(BasePermission):
    """
    Custom permission: ADMIN role lang ang pwedeng mag-access.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        try:
            return request.user.profile.role == 'ADMIN'
        except UserProfile.DoesNotExist:
            return False


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    """
    /api/me/ - Returns the currently logged-in user's info and role.
    Ito ang ginagamit ng Frontend para malaman kung STAFF o ADMIN ang naka-login.
    """
    user = request.user
    try:
        role = user.profile.role
    except UserProfile.DoesNotExist:
        # Auto-create profile kung wala pa (default STAFF)
        UserProfile.objects.create(user=user, role='STAFF')
        role = 'STAFF'

    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'role': role,
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_user(request):
    """
    /api/logout/ - Logs the logout event to AuditLog.
    """
    user = request.user
    
    # Alamin ang IP address ng kliente
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
        
    AuditLog.objects.create(
        user=user,
        action='LOGOUT',
        target_model='User',
        target_object_id=str(user.id),
        changes_summary=f"User {user.username} logged out successfully.",
        ip_address=ip
    )
    return Response({'status': 'Logged out successfully.'})

# Pagination configuration para mabilis at hindi bumagsak ang server
class StandardResultsSetPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200

from datetime import date

import hashlib

def _calculate_file_hash(file_obj):
    if not file_obj:
        return None
    hasher = hashlib.sha256()
    try:
        if hasattr(file_obj, 'seek'):
            file_obj.seek(0)
        for chunk in file_obj.chunks():
            hasher.update(chunk)
        if hasattr(file_obj, 'seek'):
            file_obj.seek(0)
        return hasher.hexdigest()
    except Exception:
        return None

def _process_document_hashes(data, files, instance_id=None):
    if 'auto_check_results' not in data or not isinstance(data['auto_check_results'], dict):
        data['auto_check_results'] = {}
    
    duplicate_warnings = []
    file_map = [
        ('psa_cert_file', 'psa_hash', 'PSA Birth Certificate'),
        ('primary_id_file', 'primary_id_hash', 'OSCA ID Card'),
        ('picture_2x2_file', 'picture_2x2_hash', '2x2 Photo'),
    ]

    for file_field, hash_field, label in file_map:
        uploaded_file = files.get(file_field)
        if uploaded_file:
            h = _calculate_file_hash(uploaded_file)
            if h:
                data[hash_field] = h
                query = Senior.objects.filter(**{hash_field: h})
                if instance_id:
                    query = query.exclude(id=instance_id)
                match = query.first()
                if match:
                    duplicate_warnings.append(
                        f"{label} has the exact same content as existing Senior #{match.id} ({match.first_name} {match.last_name}, OSCA: {match.osca_id})."
                    )

    if duplicate_warnings:
        data['auto_check_results']['duplicate_detected'] = duplicate_warnings
        data['auto_check_results']['hash_check'] = {
            'status': 'FLAGGED',
            'message': 'Duplicate document file detected in registry.',
            'duplicates': duplicate_warnings
        }
    else:
        if 'hash_check' not in data['auto_check_results']:
            data['auto_check_results']['hash_check'] = {
                'status': 'PASS',
                'message': 'All uploaded document files are unique in the registry.'
            }

def _process_server_face_verification(data, files):
    """
    Runs high-precision OpenCV face detection and feature comparison on the server.
    Ensures that auto_check_results has verified biometric face matching.
    """
    from .face_engine import detect_face, compare_face_features
    if 'auto_check_results' not in data or not isinstance(data['auto_check_results'], dict):
        data['auto_check_results'] = {}

    f_photo = files.get('picture_2x2_file')
    f_id = files.get('primary_id_file')

    photo_res = detect_face(f_photo) if f_photo else None
    id_res = detect_face(f_id) if f_id else None

    if photo_res and photo_res.get('face_detected'):
        data['auto_check_results']['photo_face_detected'] = True
        data['auto_check_results']['photo_face_confidence'] = photo_res.get('confidence', 96.0)
        data['auto_check_results']['photo_face_crop'] = photo_res.get('crop_data_url')

    if id_res and id_res.get('face_detected'):
        data['auto_check_results']['osca_face_detected'] = True
        data['auto_check_results']['osca_face_confidence'] = id_res.get('confidence', 96.0)
        data['auto_check_results']['osca_face_crop'] = id_res.get('crop_data_url')

    if photo_res and photo_res.get('face_detected') and id_res and id_res.get('face_detected'):
        comp = compare_face_features(photo_res.get('features', []), id_res.get('features', []))
        data['auto_check_results']['face_match'] = {
            'status': 'PASS' if comp['is_match'] else ('NEEDS_REVIEW' if comp['similarity'] >= 50 else 'FLAGGED'),
            'similarity_pct': comp['similarity'],
            'distance': round(1.0 - comp['correlation'], 3),
            'message': f"Biometric Match: {comp['similarity']}% similarity (OpenCV Engine)" if comp['is_match'] else f"Review required: {comp['similarity']}% similarity"
        }

class SeniorViewSet(viewsets.ModelViewSet):
    """
    API endpoint para sa mga Senior Citizens.
    Suportado ang pag-search (ex: ?search=Juan) at pag-filter (eligible, upcoming).
    """
    serializer_class = SeniorSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['first_name', 'last_name', 'osca_id']

    def create(self, request, *args, **kwargs):
        data = request.data.dict() if hasattr(request.data, 'dict') else request.data.copy()
        if 'annex_a_data' in data and isinstance(data['annex_a_data'], str):
            import json
            try:
                data['annex_a_data'] = json.loads(data['annex_a_data'])
            except json.JSONDecodeError:
                pass
        
        # Parse auto_check_results if sent as JSON string
        if 'auto_check_results' in data and isinstance(data['auto_check_results'], str):
            import json
            try:
                data['auto_check_results'] = json.loads(data['auto_check_results'])
            except json.JSONDecodeError:
                data['auto_check_results'] = {}
        
        # Process document hashes and detect duplicates across existing records
        _process_document_hashes(data, request.FILES)
        _process_server_face_verification(data, request.FILES)

        # New registrations always start as PENDING_REVIEW
        data['registration_status'] = 'PENDING_REVIEW'
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        # I-convert ang QueryDict sa regular dict para ma-handle ang JSONField
        data = request.data.dict() if hasattr(request.data, 'dict') else request.data.copy()
        instance = self.get_object()

        if 'annex_a_data' in data and isinstance(data['annex_a_data'], str):
            import json
            try:
                data['annex_a_data'] = json.loads(data['annex_a_data'])
            except json.JSONDecodeError:
                pass

        if 'auto_check_results' in data and isinstance(data['auto_check_results'], str):
            import json
            try:
                data['auto_check_results'] = json.loads(data['auto_check_results'])
            except json.JSONDecodeError:
                data['auto_check_results'] = {}

        # Process document hashes for updated files
        _process_document_hashes(data, request.FILES, instance_id=instance.id)
        _process_server_face_verification(data, request.FILES)

        was_returned = instance.registration_status == 'RETURNED'

        # When an edited profile is saved, reset status to PENDING_REVIEW for admin checking
        data['registration_status'] = 'PENDING_REVIEW'

        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if was_returned:
            resubmit_remarks = data.get('resubmission_notes', f"Staff {request.user.username if request.user.is_authenticated else 'User'} corrected documents and resubmitted for review.")
            ReviewLog.objects.create(
                senior=instance,
                reviewer=request.user if request.user.is_authenticated else None,
                action='RESUBMIT',
                remarks=resubmit_remarks
            )
            AuditLog.objects.create(
                user=request.user if request.user.is_authenticated else None,
                action='RESUBMIT',
                target_model='Senior',
                target_object_id=str(instance.id),
                changes_summary=f"Senior {instance.first_name} {instance.last_name} (OSCA: {instance.osca_id}) corrected and resubmitted for review: {resubmit_remarks}"
            )

        return Response(serializer.data)

    def get_queryset(self):
        queryset = Senior.objects.all().order_by('last_name')
        
        # Age Filter
        age_filter = self.request.query_params.get('filter', 'all')
        if age_filter != 'all':
            today = date.today()
            try:
                date_80_years_ago = today.replace(year=today.year - 80)
                date_78_years_ago = today.replace(year=today.year - 78)
            except ValueError:
                date_80_years_ago = today.replace(year=today.year - 80, month=2, day=28)
                date_78_years_ago = today.replace(year=today.year - 78, month=2, day=28)

            if age_filter == 'eligible':
                queryset = queryset.filter(date_of_birth__lte=date_80_years_ago)
            elif age_filter == 'upcoming':
                queryset = queryset.filter(date_of_birth__gt=date_80_years_ago, date_of_birth__lte=date_78_years_ago)
        
        # Status Filter
        status_param = self.request.query_params.get('status', 'all')
        if status_param != 'all':
            queryset = queryset.filter(status=status_param.upper())

        # Sex Filter
        sex_param = self.request.query_params.get('sex', 'all')
        if sex_param != 'all':
            queryset = queryset.filter(sex=sex_param.capitalize())

        # Barangay Filter
        brgy_param = self.request.query_params.get('barangay', '')
        if brgy_param:
            queryset = queryset.filter(barangay__icontains=brgy_param)
        
        # Registration Status Filter
        reg_status = self.request.query_params.get('registration_status', '')
        if reg_status:
            queryset = queryset.filter(registration_status=reg_status.upper())
                
        return queryset

    # === REVIEW WORKFLOW ACTIONS ===

    def get_permissions(self):
        if self.action in ['review_queue', 'submit_review']:
            permission_classes = [IsAuthenticated, IsAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    @action(detail=False, methods=['get'], url_path='review-queue')
    def review_queue(self, request):
        """GET /api/seniors/review-queue/ — Returns all records pending review."""
        pending = Senior.objects.filter(
            registration_status__in=['PENDING_REVIEW', 'UNDER_REVIEW']
        ).order_by('-created_at')
        serializer = self.get_serializer(pending, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='review')
    def submit_review(self, request, pk=None):
        """POST /api/seniors/{id}/review/ — Submit a review decision."""
        from django.utils import timezone
        senior = self.get_object()
        review_action = request.data.get('action', '').upper()
        remarks = request.data.get('remarks', '')
        checklist = request.data.get('checklist_results', {})

        if review_action not in ['APPROVE', 'REJECT', 'RETURN', 'ESCALATE']:
            return Response(
                {'error': 'Invalid action. Must be APPROVE, REJECT, RETURN, or ESCALATE.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create review log entry
        ReviewLog.objects.create(
            senior=senior,
            reviewer=request.user,
            action=review_action,
            remarks=remarks,
            checklist_results=checklist if isinstance(checklist, dict) else {}
        )

        # Update senior registration status
        status_map = {
            'APPROVE': 'APPROVED',
            'REJECT': 'REJECTED',
            'RETURN': 'RETURNED',
            'ESCALATE': 'UNDER_REVIEW',
        }
        senior.registration_status = status_map[review_action]
        senior.reviewed_by = request.user
        senior.reviewed_at = timezone.now()
        senior.save()

        # Audit log
        AuditLog.objects.create(
            user=request.user,
            action='REVIEW',
            target_model='Senior',
            target_object_id=str(senior.id),
            changes_summary=f"{review_action} registration for {senior.first_name} {senior.last_name} (OSCA: {senior.osca_id}). Remarks: {remarks}"
        )

        return Response({
            'status': 'success',
            'registration_status': senior.registration_status,
            'message': f'Registration {review_action.lower()}d successfully.'
        })

    @action(detail=True, methods=['get'], url_path='review-logs')
    def review_logs(self, request, pk=None):
        """GET /api/seniors/{id}/review-logs/ — Get review history for a senior."""
        senior = self.get_object()
        logs = senior.review_logs.all()
        serializer = ReviewLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='resubmit')
    def resubmit(self, request, pk=None):
        """
        POST /api/seniors/{id}/resubmit/
        Explicit 1-click action to transition a RETURNED senior back to PENDING_REVIEW.
        """
        senior = self.get_object()
        remarks = request.data.get('remarks', 'Staff confirmed corrections and resubmitted for admin verification.')
        senior.registration_status = 'PENDING_REVIEW'
        senior.save(update_fields=['registration_status'])

        ReviewLog.objects.create(
            senior=senior,
            reviewer=request.user if request.user.is_authenticated else None,
            action='RESUBMIT',
            remarks=remarks
        )

        AuditLog.objects.create(
            user=request.user if request.user.is_authenticated else None,
            action='RESUBMIT',
            target_model='Senior',
            target_object_id=str(senior.id),
            changes_summary=f"Senior {senior.first_name} {senior.last_name} (OSCA: {senior.osca_id}) resubmitted for verification: {remarks}"
        )

        return Response(SeniorSerializer(senior).data)

    @action(detail=True, methods=['post'], url_path='report-deceased')
    def report_deceased(self, request, pk=None):
        """
        POST /api/seniors/{id}/report-deceased/
        Anti-Ghost Pensioner Compliance Workflow:
        - Marks senior as DECEASED and inactive.
        - Records official date_of_death and optional death_cert_file.
        - Automatically cancels all PENDING disbursements to freeze public funds.
        - Creates a tamper-evident AuditLog entry.
        """
        senior = self.get_object()
        date_of_death = request.data.get('date_of_death')
        death_cert_file = request.FILES.get('death_cert_file')
        remarks = request.data.get('remarks', 'Demise officially reported by staff/heirs.')

        if not date_of_death:
            return Response(
                {'error': 'Date of death is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        senior.status = 'DECEASED'
        senior.is_active = False
        senior.date_of_death = date_of_death
        if death_cert_file:
            senior.death_cert_file = death_cert_file
        senior.save()

        # Cancel all pending disbursements for this senior
        cancelled_count = Disbursement.objects.filter(senior=senior, status='PENDING').update(status='CANCELLED')

        # Tamper-evident audit log
        AuditLog.objects.create(
            user=request.user if request.user.is_authenticated else None,
            action='REPORT_DECEASED',
            target_model='Senior',
            target_object_id=str(senior.id),
            changes_summary=f"Senior {senior.first_name} {senior.last_name} (OSCA: {senior.osca_id}) reported DECEASED on {date_of_death}. {cancelled_count} pending disbursements frozen and cancelled. Remarks: {remarks}"
        )

        return Response({
            'status': 'success',
            'message': f"Senior record updated to DECEASED. {cancelled_count} pending payouts successfully cancelled.",
            'cancelled_disbursements': cancelled_count
        })

    @action(detail=True, methods=['post'], url_path='extract-face-crops')
    def extract_face_crops(self, request, pk=None):
        """
        POST /api/seniors/{id}/extract-face-crops/
        Extracts face crops from picture_2x2_file and primary_id_file using OpenCV face engine,
        caches them in auto_check_results, and returns the updated senior data.
        """
        senior = self.get_object()
        from .face_engine import detect_face, compare_face_features
        import os

        auto_checks = dict(senior.auto_check_results or {})
        updated = False

        photo_feat = None
        id_feat = None

        from django.conf import settings

        def _resolve_safe_path(file_field):
            if not file_field:
                return None
            try:
                p = file_field.path
                if os.path.exists(p):
                    return p
            except Exception:
                pass
            try:
                name = str(file_field.name).lstrip('/\\')
                if name.startswith('media/'):
                    name = name[6:]
                cand = os.path.join(settings.MEDIA_ROOT, name)
                if os.path.exists(cand):
                    return cand
            except Exception:
                pass
            return None

        photo_path = _resolve_safe_path(senior.picture_2x2_file)
        if photo_path:
            try:
                res = detect_face(photo_path)
                if res.get('face_detected'):
                    auto_checks['photo_face_detected'] = True
                    auto_checks['photo_face_confidence'] = res.get('confidence', 96.0)
                    auto_checks['photo_face_crop'] = res.get('crop_data_url')
                    photo_feat = res.get('features')
                    updated = True
            except Exception as e:
                print(f"[FaceCrop] Error extracting photo face crop for Senior {senior.id}: {e}")

        id_path = _resolve_safe_path(senior.primary_id_file)
        if id_path and id_path.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            try:
                res = detect_face(id_path)
                if res.get('face_detected'):
                    auto_checks['osca_face_detected'] = True
                    auto_checks['osca_face_confidence'] = res.get('confidence', 96.0)
                    auto_checks['osca_face_crop'] = res.get('crop_data_url')
                    id_feat = res.get('features')
                    updated = True
            except Exception as e:
                print(f"[FaceCrop] Error extracting ID face crop for Senior {senior.id}: {e}")

        if photo_feat and id_feat:
            comp = compare_face_features(photo_feat, id_feat)
            auto_checks['face_match'] = {
                'status': 'PASS' if comp['is_match'] else ('NEEDS_REVIEW' if comp['similarity'] >= 50 else 'FLAGGED'),
                'similarity_pct': comp['similarity'],
                'distance': round(1.0 - comp['correlation'], 3),
                'message': f"Biometric Match: {comp['similarity']}% similarity (OpenCV Engine)" if comp['is_match'] else f"Review required: {comp['similarity']}% similarity"
            }
            updated = True

        if updated:
            senior.auto_check_results = auto_checks
            senior.save(update_fields=['auto_check_results'])

        return Response(SeniorSerializer(senior).data)

class DisbursementViewSet(viewsets.ModelViewSet):
    """
    API endpoint para sa mga Disbursements.
    Suportado ang pag-filter via ?status=PENDING|RELEASED|CANCELLED
    """
    serializer_class = DisbursementSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['reference_number', 'senior__first_name', 'senior__last_name', 'senior__osca_id']

    def get_queryset(self):
        queryset = Disbursement.objects.all().order_by('-created_at')
        status_filter = self.request.query_params.get('status', 'all')
        if status_filter != 'all':
            queryset = queryset.filter(status=status_filter.upper())
        return queryset

    def perform_update(self, serializer):
        from django.utils import timezone
        instance = self.get_object()
        new_status = self.request.data.get('status')
        if new_status == 'RELEASED' and instance.status != 'RELEASED':
            # Security guard: cannot disburse to suspended, deceased, or unapproved senior
            if instance.senior.status in ['SUSPENDED', 'DECEASED']:
                from rest_framework.exceptions import ValidationError
                raise ValidationError(f"Cannot release disbursement. Senior is currently {instance.senior.status}.")
            if instance.senior.registration_status != 'APPROVED':
                from rest_framework.exceptions import ValidationError
                raise ValidationError(f"Cannot release disbursement. Senior registration is {instance.senior.registration_status} (must be APPROVED).")
            
            serializer.save(release_date=timezone.now().date())
            # Audit log entry
            AuditLog.objects.create(
                user=self.request.user if self.request.user.is_authenticated else None,
                action='RELEASE',
                target_model='Disbursement',
                target_object_id=str(instance.id),
                changes_summary=f"Disbursement {instance.reference_number} (PHP {instance.amount}) marked as RELEASED to {instance.senior.first_name} {instance.senior.last_name}."
            )
        else:
            serializer.save()

    @action(detail=False, methods=['POST'])
    def generate_payroll(self, request):
        """
        One-Click Payroll Generator (RA 11982 & RA 11916 Compliant)
        Generates pending disbursements for eligible milestones and social pensions
        constrained by the current date/quarter limits of the target year.
        """
        from datetime import date
        today = date.today()
        
        try:
            year = int(request.data.get('year', today.year))
        except (ValueError, TypeError):
            year = today.year
            
        # Determine current quarter number based on today's month
        if 1 <= today.month <= 3:
            current_q_num = 1
        elif 4 <= today.month <= 6:
            current_q_num = 2
        elif 7 <= today.month <= 9:
            current_q_num = 3
        else:
            current_q_num = 4
            
        # Calculate maximum eligible quarter for the target year
        if year < today.year:
            max_eligible_q_num = 4
        elif year == today.year:
            max_eligible_q_num = current_q_num
        else:
            max_eligible_q_num = 0

        # Build the list of eligible quarters (e.g. ['Q1', 'Q2'] for first half of year)
        eligible_quarters = [f'Q{i}' for i in range(1, max_eligible_q_num + 1)]

        # COA Compliance: Only generate disbursements for seniors who are ACTIVE and officially APPROVED in the review queue
        active_seniors = Senior.objects.filter(status='ACTIVE', registration_status='APPROVED')
        created_count = 0
        
        for senior in active_seniors:
            # 1. Calculate age for milestone check
            dob = senior.date_of_birth
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            
            # Determine Quarter based on Senior's Birth Month
            birth_month = dob.month
            if 1 <= birth_month <= 3: senior_quarter = 'Q1'
            elif 4 <= birth_month <= 6: senior_quarter = 'Q2'
            elif 7 <= birth_month <= 9: senior_quarter = 'Q3'
            else: senior_quarter = 'Q4'

            # Milestone Gifts (RA 11982)
            amount = 0
            is_milestone = False
            if age == 100:
                amount = 100000 
                is_milestone = True
            elif age in [80, 85, 90, 95]:
                amount = 10000
                is_milestone = True
            
            if is_milestone and (senior_quarter in eligible_quarters):
                # Check if already generated for this milestone
                exists = Disbursement.objects.filter(
                    senior=senior, 
                    disbursement_type='MILESTONE_GIFT',
                    amount=amount,
                    year=year
                ).exists()
                
                if not exists:
                    Disbursement.objects.create(
                        senior=senior,
                        disbursement_type='MILESTONE_GIFT',
                        amount=amount,
                        quarter=senior_quarter, # Dynamic based on birthday
                        year=year,
                        status='PENDING',
                        reference_number=f"ECA-{year}-{senior.id}-{age}"
                    )
                    created_count += 1

            # 2. Social Pension (RA 11916) for Indigent Seniors
            if senior.is_indigent:
                for q in eligible_quarters:
                    # Check if already generated for this quarter and year
                    exists_pension = Disbursement.objects.filter(
                        senior=senior,
                        disbursement_type='SOCIAL_PENSION',
                        quarter=q,
                        year=year
                    ).exists()
                    
                    if not exists_pension:
                        Disbursement.objects.create(
                            senior=senior,
                            disbursement_type='SOCIAL_PENSION',
                            amount=3000.00, # 1,000 per month = 3,000 per quarter
                            quarter=q,
                            year=year,
                            status='PENDING',
                            reference_number=f"SP-{q}-{year}-{senior.id}"
                        )
                        created_count += 1
        
        return Response({
            'message': f'Payroll generated successfully. {created_count} new disbursements created.',
            'created_count': created_count
        })

class AnomalyFlagViewSet(viewsets.ModelViewSet):
    """
    API endpoint para sa Anomaly Detection Results.
    ADMIN ONLY - Staff ay hindi pwedeng mag-access nito.
    """
    queryset = AnomalyFlag.objects.filter(is_resolved=False).select_related('senior', 'resolved_by').order_by('-confidence_score')
    serializer_class = AnomalyFlagSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ['senior__first_name', 'senior__last_name', 'senior__osca_id', 'flag_reason']

    @action(detail=True, methods=['post'])
    def mark_as_safe(self, request, pk=None):
        flag = self.get_object()
        senior = flag.senior
        
        # 1. Resolve the flag
        flag.is_resolved = True
        flag.resolved_by = request.user
        flag.save()
        
        # 2. Ensure senior is ACTIVE
        senior.status = 'ACTIVE'
        senior.save()
        
        return Response({'status': 'Record marked as safe and flag resolved.'})

    @action(detail=True, methods=['post'])
    def suspend_record(self, request, pk=None):
        flag = self.get_object()
        senior = flag.senior
        
        # 1. Suspend the senior
        senior.status = 'SUSPENDED'
        senior.save()
        
        # 2. Flag all PENDING disbursements for this senior
        Disbursement.objects.filter(senior=senior, status='PENDING').update(status='CANCELLED') 
        # (Using CANCELLED or we can add a 'FLAGGED' status if preferred, 
        # but for now let's use a clear 'CANCELLED' to stop payout)
        
        # 3. Mark flag as resolved (meaning it's been handled)
        flag.is_resolved = True
        flag.resolved_by = request.user
        flag.save()
        
        return Response({'status': 'Senior suspended and disbursements frozen.'})

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint para sa Audit Logs (Read Only).
    ADMIN ONLY - Para sa oversight at compliance.
    """
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = AuditLog.objects.all().order_by('-created_at')
        
        # 1. Action Filter (CREATE, UPDATE, DELETE, LOGIN, REVIEW, DECEASED, RESUBMIT)
        action_param = self.request.query_params.get('action', 'all')
        if action_param and action_param != 'all':
            if action_param.upper() == 'LOGIN':
                queryset = queryset.filter(action__in=['LOGIN', 'LOGOUT'])
            else:
                queryset = queryset.filter(action__iexact=action_param)
            
        # 2. Search Term Filter (User, Model, or Summary content)
        search_param = self.request.query_params.get('search', '')
        if search_param:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(user__username__icontains=search_param) |
                Q(target_model__icontains=search_param) |
                Q(changes_summary__icontains=search_param)
            )

        # 3. Date Range Filters (date_from, date_to)
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
            
        return queryset

    @action(detail=False, methods=['get'], url_path='export')
    def export_logs(self, request):
        """
        GET /api/auditlogs/export/
        Returns unpaginated audit logs for official compliance export (COA Circular 2012-001 & RA 10173).
        Uses select_related to avoid N+1 queries on user and profile.
        """
        from django.utils import timezone
        queryset = self.get_queryset().select_related('user__profile')
        records = queryset[:2500]

        data = []
        for log in records:
            role = 'STAFF'
            if log.user:
                try:
                    role = log.user.profile.role
                except Exception:
                    role = 'ADMIN' if log.user.is_staff else 'STAFF'
            data.append({
                'id': log.id,
                'created_at': log.created_at.isoformat(),
                'username': log.user.username if log.user else 'System Auto',
                'user_role': role,
                'ip_address': log.ip_address or '127.0.0.1 (Internal)',
                'action': log.action,
                'target_model': log.target_model,
                'target_object_id': log.target_object_id or '—',
                'changes_summary': log.changes_summary
            })

        return Response({
            'count': len(data),
            'exported_at': timezone.now().isoformat(),
            'results': data
        })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def budget_forecast(request):
    """
    R.A. 11982 Milestone Appropriation & Budget Forecast Calculator.
    Calculates upcoming statutory milestone cash gifts (R.A. 11982 & R.A. 10868):
      - Ages 80, 85, 90, 95: PHP 10,000 each
      - Age 100+: PHP 100,000 each
    Query Params:
      - horizon: '1q' (3 months), '2q' (6 months), '4q' (12 months / 4 quarters, default), or 'year'
    """
    from datetime import date
    from dateutil.relativedelta import relativedelta
    today = date.today()
    horizon = request.query_params.get('horizon', '4q').lower()
    
    if horizon == '1q':
        end_date = today + relativedelta(months=3)
    elif horizon == '2q':
        end_date = today + relativedelta(months=6)
    elif horizon in ['year', '4q']:
        end_date = today + relativedelta(months=12)
    else:
        end_date = today + relativedelta(months=12)

    milestones = [80, 85, 90, 95, 100]
    active_seniors = Senior.objects.filter(status='ACTIVE')
    
    celebrants = []
    quarter_buckets = {}
    milestone_summary = {
        '80': {'count': 0, 'amount': 0},
        '85': {'count': 0, 'amount': 0},
        '90': {'count': 0, 'amount': 0},
        '95': {'count': 0, 'amount': 0},
        '100': {'count': 0, 'amount': 0},
    }
    barangay_map = {}
    
    # Pre-populate quarters in projection range
    curr = date(today.year, ((today.month - 1) // 3) * 3 + 1, 1)
    temp_q = curr
    while temp_q <= end_date:
        q_num = (temp_q.month - 1) // 3 + 1
        q_key = f"{temp_q.year}-Q{q_num}"
        if q_key not in quarter_buckets:
            quarter_buckets[q_key] = {
                'quarter': q_key,
                'year': temp_q.year,
                'quarter_num': q_num,
                'label': f"Q{q_num} {temp_q.year}",
                'count': 0,
                'amount': 0,
                'milestones': {80: 0, 85: 0, 90: 0, 95: 0, 100: 0}
            }
        temp_q += relativedelta(months=3)

    for senior in active_seniors:
        dob = senior.date_of_birth
        if not dob:
            continue
            
        for m in milestones:
            try:
                m_date = dob.replace(year=dob.year + m)
            except ValueError:
                m_date = dob.replace(year=dob.year + m, month=2, day=28)
                
            if today <= m_date <= end_date:
                q_num = (m_date.month - 1) // 3 + 1
                q_key = f"{m_date.year}-Q{q_num}"
                grant_amt = 100000 if m == 100 else 10000
                
                celebrants.append({
                    'senior_id': senior.id,
                    'name': f"{senior.last_name}, {senior.first_name} {senior.middle_name or ''}".strip(),
                    'osca_id': senior.osca_id,
                    'barangay': senior.barangay or 'General LGU',
                    'milestone_age': m,
                    'milestone_date': m_date.isoformat(),
                    'quarter': q_key,
                    'amount': grant_amt,
                    'is_indigent': senior.is_indigent
                })
                
                if q_key not in quarter_buckets:
                    quarter_buckets[q_key] = {
                        'quarter': q_key,
                        'year': m_date.year,
                        'quarter_num': q_num,
                        'label': f"Q{q_num} {m_date.year}",
                        'count': 0,
                        'amount': 0,
                        'milestones': {80: 0, 85: 0, 90: 0, 95: 0, 100: 0}
                    }
                quarter_buckets[q_key]['count'] += 1
                quarter_buckets[q_key]['amount'] += grant_amt
                quarter_buckets[q_key]['milestones'][m] += 1
                
                m_str = str(m)
                milestone_summary[m_str]['count'] += 1
                milestone_summary[m_str]['amount'] += grant_amt
                
                brgy = senior.barangay.upper() if senior.barangay else 'CENTRAL'
                if brgy not in barangay_map:
                    barangay_map[brgy] = {'name': brgy, 'count': 0, 'amount': 0}
                barangay_map[brgy]['count'] += 1
                barangay_map[brgy]['amount'] += grant_amt

    celebrants.sort(key=lambda x: x['milestone_date'])
    total_celebrants = len(celebrants)
    total_appropriation = sum(c['amount'] for c in celebrants)
    sorted_quarters = sorted(quarter_buckets.values(), key=lambda x: (x['year'], x['quarter_num']))
    sorted_barangays = sorted(barangay_map.values(), key=lambda x: x['amount'], reverse=True)[:8]

    months_count = 3 if horizon == '1q' else (6 if horizon == '2q' else 12)
    monthly_average = round(total_appropriation / months_count, 2) if months_count > 0 else 0

    return Response({
        'horizon': horizon,
        'start_date': today.isoformat(),
        'end_date': end_date.isoformat(),
        'total_celebrants': total_celebrants,
        'total_appropriation': total_appropriation,
        'monthly_average': monthly_average,
        'quarterly_forecast': sorted_quarters,
        'milestone_summary': milestone_summary,
        'top_barangays': sorted_barangays,
        'upcoming_celebrants': celebrants[:250]
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """
    Returns high-level statistics for the Dashboard.
    """
    today = date.today()
    try:
        date_80_years_ago = today.replace(year=today.year - 80)
        date_78_years_ago = today.replace(year=today.year - 78)
    except ValueError:
        date_80_years_ago = today.replace(year=today.year - 80, month=2, day=28)
        date_78_years_ago = today.replace(year=today.year - 78, month=2, day=28)

    total_seniors = Senior.objects.count()
    total_payouts = Disbursement.objects.filter(status='RELEASED').count()
    pending_payouts = Disbursement.objects.filter(status='PENDING').count()
    active_anomalies = AnomalyFlag.objects.filter(is_resolved=False).count()
    pending_reviews = Senior.objects.filter(registration_status__in=['PENDING_REVIEW', 'UNDER_REVIEW']).count()
    
    # 1. Document Verification Percentage
    # A senior is "Verified" if they have PSA, ID, and Photo
    from django.db.models import Q
    verified_seniors = Senior.objects.filter(
        ~Q(psa_cert_file='') & ~Q(psa_cert_file__isnull=True) &
        ~Q(primary_id_file='') & ~Q(primary_id_file__isnull=True) &
        ~Q(picture_2x2_file='') & ~Q(picture_2x2_file__isnull=True)
    ).count()
    
    verified_percentage = round((verified_seniors / total_seniors * 100), 1) if total_seniors > 0 else 0
    
    # 2. Last Sync (based on latest Audit Log or Senior Update)
    last_audit = AuditLog.objects.order_by('-created_at').first()
    last_sync = last_audit.created_at.isoformat() if last_audit else today.isoformat()

    # Prescriptive Analytics: Budget Forecast
    upcoming_seniors = Senior.objects.filter(
        date_of_birth__gt=date_80_years_ago, 
        date_of_birth__lte=date_78_years_ago
    ).count()
    
    estimated_budget = upcoming_seniors * 10000

    # --- ADVANCED STATS FOR CHARTS & GRAPHS ---
    # A. Status Breakdown (for Mortality/Registry "Death Chart")
    active_count = Senior.objects.filter(status='ACTIVE').count()
    deceased_count = Senior.objects.filter(status='DECEASED').count()
    suspended_count = Senior.objects.filter(status='SUSPENDED').count()
    transferred_count = Senior.objects.filter(status='TRANSFERRED').count()
    
    status_breakdown = {
        'active': active_count,
        'deceased': deceased_count,
        'suspended': suspended_count,
        'transferred': transferred_count,
    }

    # B. Active Milestones Breakdown — computed at DB level to avoid loading all seniors into Python
    from django.db.models import Case, When, IntegerField
    from datetime import date as _date

    def _cutoff(years):
        """Return the date 'years' years ago (handles Feb 29)."""
        try:
            return today.replace(year=today.year - years)
        except ValueError:
            return today.replace(year=today.year - years, month=2, day=28)

    active_qs = Senior.objects.filter(status='ACTIVE')
    milestone_breakdown = {
        'm100': active_qs.filter(date_of_birth__lte=_cutoff(100)).count(),
        'm95':  active_qs.filter(date_of_birth__lte=_cutoff(95),  date_of_birth__gt=_cutoff(100)).count(),
        'm90':  active_qs.filter(date_of_birth__lte=_cutoff(90),  date_of_birth__gt=_cutoff(95)).count(),
        'm85':  active_qs.filter(date_of_birth__lte=_cutoff(85),  date_of_birth__gt=_cutoff(90)).count(),
        'm80':  active_qs.filter(date_of_birth__lte=_cutoff(80),  date_of_birth__gt=_cutoff(85)).count(),
    }

    # C. Financial Stats Summary
    from django.db.models import Sum
    released_amount = Disbursement.objects.filter(status='RELEASED').aggregate(total=Sum('amount'))['total'] or 0
    pending_amount = Disbursement.objects.filter(status='PENDING').aggregate(total=Sum('amount'))['total'] or 0
    cancelled_amount = Disbursement.objects.filter(status='CANCELLED').aggregate(total=Sum('amount'))['total'] or 0
    
    financial_stats = {
        'released_amount': float(released_amount),
        'pending_amount': float(pending_amount),
        'cancelled_amount': float(cancelled_amount),
    }

    # D. Top Barangays Breakdown (for LGU Volume Hotspots)
    from django.db.models import Count
    top_barangays = Senior.objects.values('barangay').annotate(count=Count('id')).order_by('-count')[:5]
    barangay_breakdown = [
        {'name': b['barangay'].upper() if b['barangay'] else 'CENTRAL LGU', 'count': b['count']}
        for b in top_barangays
    ]

    # E. Sex breakdown (real database queries from new sex column)
    male_count = Senior.objects.filter(sex='Male').count()
    female_count = Senior.objects.filter(sex='Female').count()
    sex_breakdown = {
        'male': male_count,
        'female': female_count,
        'other': 0
    }

    # F. Civil Status breakdown (real database queries from new civil_status column)
    civil_status_breakdown = {
        'single': Senior.objects.filter(civil_status='SINGLE').count(),
        'married': Senior.objects.filter(civil_status='MARRIED').count(),
        'widowed': Senior.objects.filter(civil_status='WIDOWED').count(),
        'separated': Senior.objects.filter(civil_status='SEPARATED').count(),
        'divorced': Senior.objects.filter(civil_status='DIVORCED').count(),
    }

    return Response({
        'total_seniors': total_seniors,
        'total_payouts': total_payouts,
        'pending_payouts': pending_payouts,
        'pending_reviews': pending_reviews,
        'active_anomalies': active_anomalies,
        'upcoming_seniors': upcoming_seniors,
        'estimated_budget': estimated_budget,
        'verified_percentage': verified_percentage,
        'last_sync': last_sync,
        'status_breakdown': status_breakdown,
        'milestone_breakdown': milestone_breakdown,
        'financial_stats': financial_stats,
        'barangay_breakdown': barangay_breakdown,
        'sex_breakdown': sex_breakdown,
        'civil_status_breakdown': civil_status_breakdown
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ai_report_data(request):
    """
    CENTENARYO AI Intelligence Engine
    Generates prescriptive insights for fraud prevention and financial planning.
    Wrapped in try/except so any internal error returns a clean JSON 500.
    """
    try:
        from django.db.models import Count
        from collections import Counter

        # 1. Fetch all senior data in a single highly-optimized values query
        seniors_data = list(Senior.objects.values('id', 'status', 'barangay', 'annex_a_data', 'date_of_birth'))

        # 2. Budget Deficit Early Warning (Next 24 Months)
        today = date.today()
        try:
            date_80_years_ago = today.replace(year=today.year - 80)
            date_78_years_ago = today.replace(year=today.year - 78)
        except ValueError:
            date_80_years_ago = today.replace(year=today.year - 80, month=2, day=28)
            date_78_years_ago = today.replace(year=today.year - 78, month=2, day=28)

        upcoming_count = sum(
            1 for s in seniors_data
            if s['status'] == 'ACTIVE' and s['date_of_birth']
            and date_80_years_ago < s['date_of_birth'] <= date_78_years_ago
        )

        # 3. Door-to-Door Logistics (Based on Section C: Benefit Utilization)
        med_utilization = 0
        total_active_with_data = 0
        for s in seniors_data:
            if s['status'] != 'ACTIVE':
                continue

            data = s['annex_a_data'] or {}
            util = data.get('utilization', [])
            if util:
                total_active_with_data += 1
                is_medical = any(item.upper() in ['MEDICINE', 'HEALTH SERVICES', 'HEALTH'] for item in util)
                if is_medical:
                    med_utilization += 1

        med_percentage = (med_utilization / total_active_with_data * 100) if total_active_with_data > 0 else 0

        # 4. Ghost Pensioner Anomaly (Audit of Mortality vs Registry)
        # CLEAR OLD SURVIVAL FLAGS FIRST
        AnomalyFlag.objects.filter(flag_reason__icontains="Survival Rate").delete()

        try:
            date_90_years_ago = today.replace(year=today.year - 90)
        except ValueError:
            date_90_years_ago = today.replace(year=today.year - 90, month=2, day=28)

        oldest_seniors = [
            s for s in seniors_data
            if s['status'] == 'ACTIVE' and s['date_of_birth'] and s['date_of_birth'] <= date_90_years_ago
        ]
        brgy_counts = Counter(s['barangay'] for s in oldest_seniors)
        deceased_barangays = {s['barangay'] for s in seniors_data if s['status'] == 'DECEASED'}

        ghost_warnings = []
        new_flags = []

        # Keep track of existing/created flags to avoid duplicates
        created_pairs = set(AnomalyFlag.objects.exclude(
            flag_reason__icontains="Survival Rate"
        ).exclude(
            flag_reason__icontains="Syndicate Risk"
        ).values_list('senior_id', 'flag_reason'))

        for barangay, count in brgy_counts.items():
            if count >= 2:
                if barangay not in deceased_barangays:
                    reason = f"Unnatural Survival Rate: {count} seniors aged 90+ in this barangay with 0 reported deaths."

                    brgy_old_seniors = [s for s in oldest_seniors if s['barangay'] == barangay]
                    for s in brgy_old_seniors:
                        if (s['id'], reason) not in created_pairs:
                            new_flags.append(
                                AnomalyFlag(
                                    senior_id=s['id'],
                                    flag_reason=reason,
                                    confidence_score=0.85
                                )
                            )
                            created_pairs.add((s['id'], reason))

                    ghost_warnings.append({
                        'barangay': barangay,
                        'count_95plus': count,
                        'message': reason
                    })

        # 5. Syndicate / Shared Representative Detection
        AnomalyFlag.objects.filter(flag_reason__icontains="Syndicate Risk").delete()

        person_counts = Counter()
        person_to_details = {}

        for s in seniors_data:
            s_data = s['annex_a_data'] or {}
            reps = s_data.get('reps', [])
            for r in reps:
                r_name = r.get('name', '').strip().upper()
                if r_name and len(r_name) > 3:
                    person_counts[r_name] += 1
                    if r_name not in person_to_details:
                        person_to_details[r_name] = {'barangays': [], 'senior_data': {}}

                    if s['id'] not in person_to_details[r_name]['senior_data']:
                        person_to_details[r_name]['senior_data'][s['id']] = set()

                    person_to_details[r_name]['senior_data'][s['id']].add('Authorized Rep')
                    person_to_details[r_name]['barangays'].append(s['barangay'])

        syndicate_warnings = []
        for name, count in person_counts.items():
            if count >= 3:
                details = person_to_details[name]
                brgy_counter = Counter(details['barangays'])
                top_brgy = brgy_counter.most_common(1)[0][0]

                for s_id in details['senior_data'].keys():
                    reason = f"Syndicate Risk: {name} is listed as Authorized Rep for {count} seniors."
                    if (s_id, reason) not in created_pairs:
                        new_flags.append(
                            AnomalyFlag(
                                senior_id=s_id,
                                flag_reason=reason,
                                confidence_score=0.95
                            )
                        )
                        created_pairs.add((s_id, reason))

                syndicate_warnings.append({
                    'rep_name': name,
                    'count': count,
                    'barangay': top_brgy,
                    'message': f"Listed as Authorized Rep for {count} seniors."
                })

        if new_flags:
            AnomalyFlag.objects.bulk_create(new_flags, ignore_conflicts=True)

        return Response({
            'budget_forecast': {
                'upcoming_beneficiaries': upcoming_count,
                'recommended_funding': upcoming_count * 10000,
                'warning': upcoming_count > 20
            },
            'logistics': {
                'medical_utilization_rate': round(med_percentage, 1),
                'recommendation': 'Prioritize Door-to-Door Payout' if med_percentage > 50 else 'Standard Payout'
            },
            'ghost_warnings': ghost_warnings,
            'syndicate_warnings': syndicate_warnings,
            'data_integrity': 'HIGH' if total_active_with_data > 0 else 'LOW_DATA'
        })

    except Exception as e:
        import traceback
        print(f"[AI Report] Error: {e}\n{traceback.format_exc()}")
        return Response(
            {'error': f'AI report generation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )





    


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def verify_face(request):
    """
    POST /api/verify-face/
    Accepts:
    - 'file': multipart image file
    - 'image_base64': base64 data URL or raw base64 string
    Runs high-precision OpenCV multi-stage cascade face detection with CLAHE.
    Returns:
    {
      'face_detected': bool,
      'confidence': float,
      'box': {'x': int, 'y': int, 'width': int, 'height': int},
      'crop_data_url': str,
      'features': list[float],
      'message': str
    }
    """
    from .face_engine import detect_face
    
    img_input = None
    if 'file' in request.FILES:
        img_input = request.FILES['file']
    elif 'image_base64' in request.data:
        img_input = request.data.get('image_base64')
    elif 'file' in request.data and isinstance(request.data.get('file'), str):
        img_input = request.data.get('file')
    
    if not img_input:
        return Response(
            {'face_detected': False, 'confidence': 0, 'message': 'No image file or image_base64 provided.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    result = detect_face(img_input)
    return Response(result, status=status.HTTP_200_OK)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def compare_faces(request):
    """
    POST /api/compare-faces/
    Accepts:
    - 'features1': list of floats (256 dimensions)
    - 'features2': list of floats (256 dimensions)
    Compares two face feature vectors and returns similarity percentage.
    """
    from .face_engine import compare_face_features
    
    feat1 = request.data.get('features1')
    feat2 = request.data.get('features2')
    
    if not feat1 or not feat2:
        return Response(
            {'similarity': 0, 'is_match': False, 'message': 'Both features1 and features2 are required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    res = compare_face_features(feat1, feat2)
    return Response(res, status=status.HTTP_200_OK)

