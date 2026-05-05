from django.contrib import admin
from .models import Senior, Disbursement, AuditLog, AnomalyFlag

# Papagandahin natin ang display sa Admin Panel gamit ang mga classes na ito

@admin.register(Senior)
class SeniorAdmin(admin.ModelAdmin):
    # Mga columns na makikita sa listahan
    list_display = ('first_name', 'last_name', 'date_of_birth', 'osca_id', 'barangay', 'is_indigent', 'is_active', 'risk_score')
    
    # Para madaling mag-search ang admin
    search_fields = ('first_name', 'last_name', 'osca_id')
    
    # Filters sa gilid ng Admin Panel
    list_filter = ('is_indigent', 'is_active', 'barangay')
    
    # Read-only fields para hindi mapalitan accidentally
    readonly_fields = ('created_at', 'updated_at')

@admin.register(Disbursement)
class DisbursementAdmin(admin.ModelAdmin):
    list_display = ('reference_number', 'senior', 'amount', 'quarter', 'year', 'status')
    search_fields = ('senior__first_name', 'senior__last_name', 'reference_number')
    list_filter = ('status', 'quarter', 'year')
    readonly_fields = ('created_at', 'updated_at')
    
    # Mga Custom Actions
    actions = ['mark_as_released', 'cancel_disbursement']

    @admin.action(description='Mark selected as Released')
    def mark_as_released(self, request, queryset):
        queryset.update(status='RELEASED')

    @admin.action(description='Cancel selected Disbursements')
    def cancel_disbursement(self, request, queryset):
        queryset.update(status='CANCELLED')

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action', 'target_model', 'target_object_id', 'created_at')
    list_filter = ('action', 'target_model')
    search_fields = ('user__username', 'action', 'target_model', 'changes_summary')
    
    # Dapat read-only ang Audit Logs para sa integrity (hindi pwedeng i-edit ng admin ang history)
    def has_change_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(AnomalyFlag)
class AnomalyFlagAdmin(admin.ModelAdmin):
    list_display = ('senior', 'flag_reason', 'confidence_score', 'is_resolved', 'created_at')
    list_filter = ('is_resolved',)
    search_fields = ('senior__first_name', 'senior__last_name', 'flag_reason')
    readonly_fields = ('created_at', 'updated_at')
    
    actions = ['mark_as_resolved']

    @admin.action(description='Mark selected anomalies as Resolved')
    def mark_as_resolved(self, request, queryset):
        # We can also automatically set the resolved_by field if we overwrite the method but this simple update is fine.
        queryset.update(is_resolved=True)
