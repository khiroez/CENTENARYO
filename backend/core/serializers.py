from rest_framework import serializers
from .models import Senior, Disbursement, AuditLog, AnomalyFlag

class AnomalyFlagSerializer(serializers.ModelSerializer):
    senior_name = serializers.SerializerMethodField()
    senior_osca_id = serializers.SerializerMethodField()

    class Meta:
        model = AnomalyFlag
        fields = '__all__'

    def get_senior_name(self, obj):
        return f"{obj.senior.first_name} {obj.senior.last_name}"

    def get_senior_osca_id(self, obj):
        return obj.senior.osca_id

class DisbursementSerializer(serializers.ModelSerializer):
    senior_name = serializers.SerializerMethodField()
    senior_osca_id = serializers.SerializerMethodField()
    senior_barangay = serializers.SerializerMethodField()
    type_display = serializers.CharField(source='get_disbursement_type_display', read_only=True)
    milestone_age = serializers.SerializerMethodField()

    class Meta:
        model = Disbursement
        fields = '__all__'

    def get_milestone_age(self, obj):
        from datetime import date
        today = date.today()
        dob = obj.senior.date_of_birth
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        
        # Round down to nearest milestone if it's a milestone gift
        if obj.disbursement_type == 'MILESTONE_GIFT':
            if age >= 100: return 100
            if age >= 95: return 95
            if age >= 90: return 90
            if age >= 85: return 85
            if age >= 80: return 80
            return 0 # Should not happen with clean data but for safety
        return age

    def get_senior_name(self, obj):
        return f"{obj.senior.last_name}, {obj.senior.first_name}"

    def get_senior_osca_id(self, obj):
        return obj.senior.osca_id

    def get_senior_barangay(self, obj):
        return obj.senior.barangay

class SeniorSerializer(serializers.ModelSerializer):
    # Kasama ang related disbursements at anomalies kapag finetch ang Senior!
    disbursements = DisbursementSerializer(many=True, read_only=True)
    anomalies = AnomalyFlagSerializer(many=True, read_only=True)

    class Meta:
        model = Senior
        fields = '__all__'

    def validate_date_of_birth(self, value):
        from datetime import date
        today = date.today()
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if age < 78:
            raise serializers.ValidationError("Senior citizen must be at least 78 years old to be registered.")
        return value

    def validate(self, data):
        civil_status = data.get('civil_status', '')
        annex_a_data = data.get('annex_a_data', {})
        
        # If civil status is not MARRIED (e.g. SINGLE, WIDOWED, SEPARATED), ensure spouse details are cleared in annex_a_data
        if civil_status != 'MARRIED':
            if isinstance(annex_a_data, dict):
                annex_a_data['spouse_name'] = ''
                annex_a_data['spouse_citizenship'] = ''
                data['annex_a_data'] = annex_a_data
        
        # Ensure is_indigent defaults to True for newly registered seniors so they get social pensions
        if 'is_indigent' not in data:
            data['is_indigent'] = True
        
        return data

class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = '__all__'
