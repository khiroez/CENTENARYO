from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import UserProfile


class Command(BaseCommand):
    help = 'Creates default STAFF and ADMIN users for CENTENARYO RBAC testing'

    def handle(self, *args, **kwargs):
        # --- ADMIN User ---
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@centenaryo.gov.ph',
                'first_name': 'System',
                'last_name': 'Administrator',
                'is_staff': True,
            }
        )
        admin_user.set_password('admin123')
        admin_user.save()
        self.stdout.write(self.style.SUCCESS('Password secured for ADMIN: admin / admin123'))

        UserProfile.objects.update_or_create(
            user=admin_user,
            defaults={'role': 'ADMIN'}
        )

        # --- STAFF User ---
        staff_user, created = User.objects.get_or_create(
            username='staff',
            defaults={
                'email': 'staff@centenaryo.gov.ph',
                'first_name': 'LGU',
                'last_name': 'Encoder',
            }
        )
        staff_user.set_password('staff123')
        staff_user.save()
        self.stdout.write(self.style.SUCCESS('Password secured for STAFF: staff / staff123'))

        UserProfile.objects.update_or_create(
            user=staff_user,
            defaults={'role': 'STAFF'}
        )

        self.stdout.write(self.style.SUCCESS('\n=== CENTENARYO RBAC Users Ready ==='))
        self.stdout.write(self.style.SUCCESS('ADMIN: admin / admin123  (Full Access)'))
        self.stdout.write(self.style.SUCCESS('STAFF: staff / staff123  (Limited Access)'))
