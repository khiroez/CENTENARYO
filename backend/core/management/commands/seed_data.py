from django.core.management.base import BaseCommand
from core.models import Senior, Disbursement, UserProfile
from django.contrib.auth.models import User
from datetime import date, timedelta
import random

class Command(BaseCommand):
    help = 'Seeds the database with RA 11982 compliant mock data'

    def handle(self, *args, **kwargs):
        self.stdout.write('Cleaning old data...')
        Disbursement.objects.all().delete()
        Senior.objects.all().delete()
        
        # Ensure Admin user exists
        admin_user, _ = User.objects.get_or_create(username='admin', is_staff=True)
        admin_user.set_password('admin123')
        admin_user.save()
        UserProfile.objects.update_or_create(user=admin_user, defaults={'role': 'ADMIN'})

        # Ensure Staff user exists
        staff_user, _ = User.objects.get_or_create(username='staff', is_staff=False)
        staff_user.set_password('staff123')
        staff_user.save()
        UserProfile.objects.update_or_create(user=staff_user, defaults={'role': 'STAFF'})

        barangays = ['San Jose', 'Poblacion', 'San Roque', 'Magallanes', 'Rizal', 'Mabini', 'Barangay 1']
        last_names = ['Garcia', 'Bautista', 'Dela Cruz', 'Lopez', 'Cruz', 'Santos', 'Reyes', 'Aquino']
        first_names = ['Maria', 'Juan', 'Jose', 'Rosa', 'Antonio', 'Corazon', 'Luz', 'Carmen']
        
        today = date.today()
        
        self.stdout.write('Generating Seniors...')
        
        # We want to test specific milestones
        milestone_ages = [78, 79, 80, 85, 90, 95, 100, 101]
        
        seniors_created = []
        for i in range(100): # Create 100 seniors
            ln = random.choice(last_names)
            fn = random.choice(first_names)
            brgy = random.choice(barangays)
            
            # Pick an age from our milestone list or random
            if i < len(milestone_ages):
                target_age = milestone_ages[i]
            else:
                target_age = random.randint(75, 102)
                
            dob = today.replace(year=today.year - target_age) - timedelta(days=random.randint(0, 364))
            
            osca_id = f"OSCA-2026-10{i:03d}"
            
            # Realistic Annex A Data
            annex_data = {
                'res_house': str(random.randint(1, 200)),
                'res_street': 'Street Name',
                'res_brgy': brgy,
                'res_city': 'Cavite City',
                'res_prov': 'Cavite',
                'primary_ben_name': f"{random.choice(first_names)} {ln}",
                'primary_ben_rel': random.choice(['Child', 'Grandchild', 'Spouse']),
                'utilization': random.sample(['FOOD', 'MEDICINE', 'HEALTH SERVICES', 'HOUSEHOLD NEEDS'], random.randint(1, 3)),
                'contact_number': f"0917{random.randint(1000000, 9999999)}"
            }
            
            s = Senior.objects.create(
                first_name=fn,
                last_name=ln,
                date_of_birth=dob,
                osca_id=osca_id,
                barangay=brgy,
                status='ACTIVE',
                annex_a_data=annex_data
            )
            seniors_created.append(s)

        self.stdout.write('Generating Disbursements...')
        for s in seniors_created:
            # 1. GENERATE QUARTERLY SOCIAL PENSION (₱3,000 for ALL)
            for q_name in ['Q1', 'Q2', 'Q3', 'Q4']:
                Disbursement.objects.create(
                    senior=s,
                    disbursement_type='SOCIAL_PENSION',
                    amount=3000,
                    quarter=q_name,
                    year=2026,
                    status=random.choice(['PENDING', 'RELEASED']),
                    reference_number=f"SP-{q_name}-2026-{s.id}",
                    release_date=today if random.random() > 0.4 else None
                )

            # 2. GENERATE MILESTONE GIFTS (Birthday-Quarter Specific)
            dob = s.date_of_birth
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            
            month = dob.month
            if month in [1, 2, 3]: q = 'Q1'
            elif month in [4, 5, 6]: q = 'Q2'
            elif month in [7, 8, 9]: q = 'Q3'
            else: q = 'Q4'
            
            amount = 0
            if age >= 100:
                amount = 100000
            elif age in [80, 85, 90, 95]:
                amount = 10000
                
            if amount > 0:
                Disbursement.objects.create(
                    senior=s,
                    disbursement_type='MILESTONE_GIFT',
                    amount=amount,
                    quarter=q,
                    year=2026,
                    status=random.choice(['PENDING', 'RELEASED']),
                    reference_number=f"ECA-2026-{s.id}-{age}",
                    release_date=today if random.random() > 0.5 else None
                )

        self.stdout.write(self.style.SUCCESS(f'Successfully seeded {len(seniors_created)} seniors and milestones!'))
