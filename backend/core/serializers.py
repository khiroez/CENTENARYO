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

class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = '__all__'
