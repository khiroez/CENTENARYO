from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, BasePermission, AllowAny
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from .models import Senior, Disbursement, AuditLog, AnomalyFlag, UserProfile
from .serializers import SeniorSerializer, DisbursementSerializer, AuditLogSerializer, AnomalyFlagSerializer


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
        'is_superuser': user.is_superuser,
    })
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
                
        return queryset

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
        One-Click Payroll Generator (RA 11982 Compliant)
        Awtomatikong tinitingnan ang mga seniors na nag-birthday sa quarter na ito
        at gumagawa ng PENDING disbursements.
        """
        from datetime import date
        today = date.today()
        # Halimbawa: Q3 2026
        quarter = request.data.get('quarter', 'Q3')
        year = request.data.get('year', today.year)
        
        active_seniors = Senior.objects.filter(status='ACTIVE')
        created_count = 0
        
        for senior in active_seniors:
            # Calculate age for milestone check
            dob = senior.date_of_birth
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            
            # Determine Quarter based on Senior's Birth Month
            birth_month = dob.month
            if 1 <= birth_month <= 3: senior_quarter = 'Q1'
            elif 4 <= birth_month <= 6: senior_quarter = 'Q2'
            elif 7 <= birth_month <= 9: senior_quarter = 'Q3'
            else: senior_quarter = 'Q4'

            amount = 0
            is_milestone = False
            
            # RA 11982 Milestones
            if age == 100:
                amount = 100000 
                is_milestone = True
            elif age in [80, 85, 90, 95]:
                amount = 10000
                is_milestone = True
            
            if is_milestone:
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
    queryset = AuditLog.objects.all().order_by('-created_at')
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

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

    return Response({
        'total_seniors': total_seniors,
        'total_payouts': total_payouts,
        'pending_payouts': pending_payouts,
        'active_anomalies': active_anomalies,
        'upcoming_seniors': upcoming_seniors,
        'estimated_budget': estimated_budget,
        'verified_percentage': verified_percentage,
        'last_sync': last_sync
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
