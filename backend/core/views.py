from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, BasePermission, AllowAny
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
    max_page_size = 1000

from datetime import date

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
        
        # New registrations always start as PENDING_REVIEW
        data['registration_status'] = 'PENDING_REVIEW'
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        # I-convert ang QueryDict sa regular dict para ma-handle ang JSONField
        data = request.data.dict() if hasattr(request.data, 'dict') else request.data.copy()
        
        if 'annex_a_data' in data and isinstance(data['annex_a_data'], str):
            import json
            try:
                data['annex_a_data'] = json.loads(data['annex_a_data'])
            except json.JSONDecodeError:
                pass
        
        # When an edited profile is saved, reset status to PENDING_REVIEW for admin checking
        data['registration_status'] = 'PENDING_REVIEW'

        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
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
            
        eligible_quarters = ['Q1', 'Q2', 'Q3', 'Q4'][:max_eligible_q_num]
        
        active_seniors = Senior.objects.filter(status='ACTIVE')
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
    queryset = AnomalyFlag.objects.filter(is_resolved=False).order_by('-confidence_score')
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
        
        # 1. Action Filter (CREATE, UPDATE, DELETE, LOGIN)
        action_param = self.request.query_params.get('action', 'all')
        if action_param and action_param != 'all':
            if action_param.upper() == 'LOGIN':
                queryset = queryset.filter(action__in=['LOGIN', 'LOGOUT'])
            else:
                queryset = queryset.filter(action=action_param.upper())
            
        # 2. Search Term Filter (User, Model, or Summary content)
        search_param = self.request.query_params.get('search', '')
        if search_param:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(user__username__icontains=search_param) |
                Q(target_model__icontains=search_param) |
                Q(changes_summary__icontains=search_param)
            )
            
        return queryset

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

    # B. Active Milestones Breakdown (for Age distribution Bar Chart)
    milestone_breakdown = {
        'm80': 0,
        'm85': 0,
        'm90': 0,
        'm95': 0,
        'm100': 0,
    }
    for s in Senior.objects.filter(status='ACTIVE'):
        dob = s.date_of_birth
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        if age >= 100:
            milestone_breakdown['m100'] += 1
        elif age >= 95:
            milestone_breakdown['m95'] += 1
        elif age >= 90:
            milestone_breakdown['m90'] += 1
        elif age >= 85:
            milestone_breakdown['m85'] += 1
        elif age >= 80:
            milestone_breakdown['m80'] += 1

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
    """
    from django.db.models import Count
    from collections import Counter
    
    seniors = Senior.objects.all()

    # 1. Budget Deficit Early Warning (Next 24 Months)
    today = date.today()
    try:
        date_80_years_ago = today.replace(year=today.year - 80)
        date_78_years_ago = today.replace(year=today.year - 78)
    except ValueError:
        date_80_years_ago = today.replace(year=today.year - 80, month=2, day=28)
        date_78_years_ago = today.replace(year=today.year - 78, month=2, day=28)

    upcoming_count = Senior.objects.filter(
        date_of_birth__gt=date_80_years_ago, 
        date_of_birth__lte=date_78_years_ago,
        status='ACTIVE' # Only count active seniors for budgeting
    ).count()
    
    # 3. Door-to-Door Logistics (Based on Section C: Benefit Utilization)
    med_utilization = 0
    total_active_with_data = 0
    for s in seniors:
        if s.status != 'ACTIVE': continue
        
        data = s.annex_a_data or {}
        util = data.get('utilization', [])
        # Normalizing utilization check
        if util:
            total_active_with_data += 1
            is_medical = any(item.upper() in ['MEDICINE', 'HEALTH SERVICES', 'HEALTH'] for item in util)
            if is_medical:
                med_utilization += 1
    
    med_percentage = (med_utilization / total_active_with_data * 100) if total_active_with_data > 0 else 0

    # 4. Ghost Pensioner Anomaly (Audit of Mortality vs Registry)
    # CLEAR OLD SURVIVAL FLAGS FIRST
    AnomalyFlag.objects.filter(flag_reason__icontains="Survival Rate").delete()
    
    date_90_years_ago = today.replace(year=today.year - 90)
    # Filter only very old seniors who are still marked as ACTIVE
    oldest_seniors = Senior.objects.filter(date_of_birth__lte=date_90_years_ago, status='ACTIVE')
    brgy_stats = oldest_seniors.values('barangay').annotate(count=Count('id')).filter(count__gte=2)
    
    ghost_warnings = []
    for item in brgy_stats:
        # If a barangay has multiple 90+ seniors but ZERO deaths reported in the system
        has_deceased = Senior.objects.filter(barangay=item['barangay'], status='DECEASED').exists()
        if not has_deceased:
            reason = f"Unnatural Survival Rate: {item['count']} seniors aged 90+ in this barangay with 0 reported deaths."
            
            # AUTO-FLAG these individual seniors
            for s_obj in oldest_seniors.filter(barangay=item['barangay']):
                AnomalyFlag.objects.get_or_create(
                    senior=s_obj,
                    flag_reason=reason,
                    defaults={'confidence_score': 0.85}
                )

            ghost_warnings.append({
                'barangay': item['barangay'],
                'count_95plus': item['count'],
                'message': reason
            })

    # 5. Syndicate / Shared Representative Detection (REPRESENTATIVES ONLY)
    # Clear old syndicate flags first to avoid stale data (based on keywords)
    AnomalyFlag.objects.filter(flag_reason__icontains="Syndicate Risk").delete()
    
    person_counts = Counter()
    person_to_details = {} # name -> {'barangays': [], 'senior_data': {senior_id: set(roles)}}
    
    for s in seniors:
        s_data = s.annex_a_data or {}
        
        # ONLY Check Representatives
        reps = s_data.get('reps', [])
        for r in reps:
            r_name = r.get('name', '').strip().upper()
            if r_name and len(r_name) > 3:
                person_counts[r_name] += 1
                if r_name not in person_to_details:
                    person_to_details[r_name] = {'barangays': [], 'senior_data': {}}
                
                if s.id not in person_to_details[r_name]['senior_data']:
                    person_to_details[r_name]['senior_data'][s.id] = set()
                
                person_to_details[r_name]['senior_data'][s.id].add('Authorized Rep')
                person_to_details[r_name]['barangays'].append(s.barangay)
    
    syndicate_warnings = []
    for name, count in person_counts.items():
        if count >= 3:
            details = person_to_details[name]
            brgy_counts = Counter(details['barangays'])
            top_brgy = brgy_counts.most_common(1)[0][0]
            
            # AUTO-FLAGGING: Per-senior specific messages
            for s_id, roles in details['senior_data'].items():
                try:
                    s_obj = Senior.objects.get(id=s_id)
                    # More accurate reason
                    reason = f"Syndicate Risk: {name} is listed as Authorized Rep for {count} seniors."
                    
                    AnomalyFlag.objects.get_or_create(
                        senior=s_obj,
                        flag_reason=reason,
                        defaults={'confidence_score': 0.95}
                    )
                except Senior.DoesNotExist:
                    continue

            syndicate_warnings.append({
                'rep_name': name,
                'count': count,
                'barangay': top_brgy,
                'message': f"Listed as Authorized Rep for {count} seniors."
            })

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
