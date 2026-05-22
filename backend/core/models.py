from django.db import models
from django.contrib.auth.models import User

class Senior(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('DECEASED', 'Deceased'),
        ('TRANSFERRED', 'Transferred'),
        ('SUSPENDED', 'Suspended/Fraud'),
    ]
    SEX_CHOICES = [
        ('Male', 'Male'),
        ('Female', 'Female'),
    ]
    CIVIL_STATUS_CHOICES = [
        ('SINGLE', 'Single'),
        ('MARRIED', 'Married'),
        ('WIDOWED', 'Widowed'),
        ('SEPARATED', 'Separated'),
    ]

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True, null=True)
    date_of_birth = models.DateField()
    osca_id = models.CharField(max_length=50, unique=True, help_text="Official OSCA ID Number")
    barangay = models.CharField(max_length=100)
    is_indigent = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    sex = models.CharField(max_length=10, choices=SEX_CHOICES, default='Male')
    civil_status = models.CharField(max_length=20, choices=CIVIL_STATUS_CHOICES, default='SINGLE')
    
    # Machine Learning / Analytics fields
    risk_score = models.FloatField(default=0.0, help_text="Anomaly risk score from Random Forest model")
    
    # New Annex A Data (Stores Address, Family, Utilization, etc.)
    annex_a_data = models.JSONField(default=dict, blank=True)

    # Documentary Requirements (Section G)
    psa_cert_file = models.FileField(upload_to='requirements/psa/', null=True, blank=True)
    primary_id_file = models.FileField(upload_to='requirements/id/', null=True, blank=True)
    picture_2x2_file = models.ImageField(upload_to='requirements/pictures/', null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.osca_id}) - {self.status}"

class Disbursement(models.Model):
    QUARTER_CHOICES = [
        ('Q1', 'Quarter 1 (Jan-Mar)'),
        ('Q2', 'Quarter 2 (Apr-Jun)'),
        ('Q3', 'Quarter 3 (Jul-Sep)'),
        ('Q4', 'Quarter 4 (Oct-Dec)'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('RELEASED', 'Released'),
        ('CANCELLED', 'Cancelled'),
    ]
    TYPE_CHOICES = [
        ('SOCIAL_PENSION', 'DSWD Social Pension'),
        ('MILESTONE_GIFT', 'Centenarian/Milestone Gift'),
    ]
    senior = models.ForeignKey(Senior, on_delete=models.CASCADE, related_name='disbursements')
    disbursement_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='SOCIAL_PENSION')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    quarter = models.CharField(max_length=2, choices=QUARTER_CHOICES)
    year = models.IntegerField()
    release_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    reference_number = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.reference_number} - {self.senior} ({self.status})"

class AuditLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    activity = models.CharField(max_length=255)
    reference_id = models.CharField(max_length=100, blank=True, null=True, help_text="Related ID (e.g., Disbursement Ref or Senior OSCA ID)")
    status = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] {self.activity}"

class UserProfile(models.Model):
    """
    Extends Django User para sa CENTENARYO RBAC system.
    STAFF = LGU/NCSC Encoder (limited access)
    ADMIN = Oversight/Auditor (full access + anomaly review)
    """
    ROLE_CHOICES = [
        ('STAFF', 'Staff (LGU/NCSC Encoder)'),
        ('ADMIN', 'Admin (Oversight/Auditor)'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='STAFF')

    def __str__(self):
        return f"{self.user.username} ({self.role})"

class AnomalyFlag(models.Model):
    senior = models.ForeignKey(Senior, on_delete=models.CASCADE, related_name='anomalies')
    flag_reason = models.CharField(max_length=255)
    confidence_score = models.FloatField(help_text="ML Confidence Score (0.0 to 1.0)")
    is_resolved = models.BooleanField(default=False)
    resolved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='resolved_anomalies')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class AuditLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=50) # CREATE, UPDATE, DELETE, LOGIN
    target_model = models.CharField(max_length=100)
    target_object_id = models.CharField(max_length=255, null=True, blank=True)
    changes_summary = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} on {self.target_model} by {self.user}"

# --- SIGNALS FOR AUDIT LOGGING ---
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

@receiver(post_save, sender=Senior)
def log_senior_changes(sender, instance, created, **kwargs):
    action = 'CREATE' if created else 'UPDATE'
    AuditLog.objects.create(
        action=action,
        target_model='Senior',
        target_object_id=str(instance.id),
        changes_summary=f"{action} Senior: {instance.first_name} {instance.last_name} (OSCA: {instance.osca_id})"
    )

@receiver(post_save, sender=Disbursement)
def log_disbursement_changes(sender, instance, created, **kwargs):
    action = 'CREATE' if created else 'UPDATE'
    AuditLog.objects.create(
        action=action,
        target_model='Disbursement',
        target_object_id=str(instance.id),
        changes_summary=f"{action} Disbursement for Senior ID {instance.senior_id}. Status: {instance.status}"
    )

@receiver(post_delete, sender=Senior)
def log_senior_deletion(sender, instance, **kwargs):
    AuditLog.objects.create(
        action='DELETE',
        target_model='Senior',
        target_object_id=str(instance.id),
        changes_summary=f"Deleted Senior record: {instance.first_name} {instance.last_name}"
    )
