from django.core.management.base import BaseCommand
from core.models import Senior, Disbursement, UserProfile, AuditLog
from django.contrib.auth.models import User
from django.db import transaction
from datetime import date, timedelta
import random
import os
import re

class Command(BaseCommand):
    help = 'Seeds the database with RA 11982 compliant mock data for Quezon City using unique extracted names'

    def handle(self, *args, **kwargs):
        self.stdout.write('Cleaning old data...')
        with transaction.atomic():
            Disbursement.objects.all().delete()
            Senior.objects.all().delete()
            AuditLog.objects.all().delete()
        
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

        # Quezon City Districts and Barangays
        qc_districts = {
            'District 1': ['Vasra','Bagong Pag-asa','Sto. Cristo','Project 6','Ramon Magsaysay','Alicia','Bahay Toro','Katipunan','San Antonio','Veterans Village','Bungad','Phil-Am','West Triangle','Sta. Cruz','Nayong Kanluran','Paltok','Paraiso','Mariblo','Damayan','Del Monte','Masambong','Talayan','Sto. Domingo','Siena','St. Peter','San Jose','Manresa','Damar','Pag-ibig sa Nayon','Balingasa','Sta. Teresita','San Isidro Labrador','Paang Bundok','Salvacion','N.S Amoranto','Maharlika','Lourdes'],
            'District 2': ['Bagong Silangan','Batasan Hills','Commonwealth','Holy Spirit','Payatas'],
            'District 3': ['Silangan','Socorro','E. Rodriguez','West Kamias','East Kamias','Quirino 2-A','Quirino 2-B','Quirino 2-C','Quirino 3-A','Claro (Quirino 3-B)','Duyan-Duyan','Amihan','Matandang Balara','Pansol','Loyola Heights','San Roque','Mangga','Masagana','Villa Maria Clara','Bayanihan','Camp Aguinaldo','White Plains','Libis','Ugong Norte','Bagumbayan','Blue Ridge A','Blue Ridge B','St. Ignatius','Milagrosa','Escopa I','Escopa II','Escopa III','Escopa IV','Marilag','Bagumbuhay','Tagumpay','Dioquino Zobel'],
            'District 4': ['Sacred Heart','Laging Handa','Obrero','Paligsahan','Roxas','Kamuning','South Triangle','Pinagkaisahan','Immaculate Concepcion','San Martin De Porres','Kaunlaran','Bagong Lipunan ng Crame','Horseshoe','Valencia','Tatalon','Kalusugan','Kristong Hari','Damayang Lagi','Mariana','Doña Imelda','Santol','Sto. Niño','San Isidro Galas','Doña Aurora','Don Manuel','Doña Josefa','UP Village','Old Capitol Site','UP Campus','San Vicente','Teachers Village East','Teachers Village West','Central','Pinyahan','Malaya','Sikatuna Village','Botocan','Krus Na Ligas'],
            'District 5': ['Bagbag','Capri','Greater Lagro','Gulod','Kaligayahan','Nagkaisang Nayon','North Fairview','Novaliches Proper','Pasong Putik Proper','San Agustin','San Bartolome','Sta. Lucia','Sta. Monica','Fairview'],
            'District 6': ['Apolonio Samson','Baesa','Balon Bato','Culiat','New Era','Pasong Tamo','Sangandaan','Tandang Sora','Unang Sigaw','Sauyo','Talipapa'],
        }

        # Parse the extracted names from the markdown file
        names_file_path = r'd:\codes\cen4\extracted_names_839.md'
        parsed_names = []
        if os.path.exists(names_file_path):
            self.stdout.write(f'Reading names from {names_file_path}...')
            with open(names_file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    # Match lines like | 1 | DIAZ | NENITA | COSTIN |
                    match = re.match(r'^\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|$', line)
                    if match:
                        last = match.group(1).strip()
                        first = match.group(2).strip()
                        middle = match.group(3).strip()
                        parsed_names.append((first, middle, last))
        else:
            self.stdout.write(self.style.WARNING(f'Warning: {names_file_path} not found. Using default names.'))
            parsed_names = [
                ('Nenita', 'Costin', 'Diaz'),
                ('Ramon', 'Perez', 'Abalos'),
                ('Valentina', 'Panfilo', 'Dabi'),
                ('Rosa', 'Ngo', 'Lao'),
                ('Maria', 'Sebastian', 'Abuyuan')
            ]

        # De-duplicate names from the file
        seen_names = set()
        unique_names = []
        for first, middle, last in parsed_names:
            key = (first.upper(), middle.upper(), last.upper())
            if key not in seen_names:
                seen_names.add(key)
                unique_names.append((first, middle, last))

        self.stdout.write(f'Found {len(unique_names)} unique names in the extracted file.')

        # Collect name pools for generating remaining names up to 1300
        all_firsts = list(set([n[0] for n in unique_names]))
        all_middles = list(set([n[1] for n in unique_names]))
        all_lasts = list(set([n[2] for n in unique_names]))

        # Generate unique name combinations to fill up to 1300 records
        while len(unique_names) < 1300:
            first = random.choice(all_firsts)
            middle = random.choice(all_middles)
            last = random.choice(all_lasts)
            key = (first.upper(), middle.upper(), last.upper())
            if key not in seen_names:
                seen_names.add(key)
                unique_names.append((first, middle, last))

        self.stdout.write(f'Total target unique names generated: {len(unique_names)}')

        # Helper to guess sex from first name
        def guess_sex(first_name):
            first_upper = first_name.upper()
            female_endings = ('ITA', 'INA', 'ILA', 'ELA', 'CIA', 'OSA', 'RIA', 'ISA', 'IDA', 'DRA', 'ORA', 'NZA', 'LZA', 'NDA', 'RTA', 'ICA')
            female_names = {'MARIA', 'LUZ', 'CORAZON', 'ESTRELLA', 'FE', 'CARMEN', 'TERESA', 'JOSEFINA', 'LOURDES', 'VIRGINIA', 'ESPERANZA', 'IMELDA', 'ROSARIO', 'MERCEDES', 'CONCEPCION', 'BEATRIZ', 'DOLORES', 'GLORIA', 'PAZ', 'SOCORRO', 'PILAR', 'NIEVES', 'REMEDIOS', 'CONSUELO', 'ANTONINA', 'ISABELITA', 'LETECIA', 'JULITA', 'LUISA', 'EMILIA'}
            male_names = {'RAMON', 'PERFECTO', 'EDUARDO', 'MARCELINO', 'FORTUNATO', 'ALBERTO', 'PACIFICO', 'CARLITO', 'DOMINGO', 'FLORENCIO', 'JOSE', 'ANTONIO', 'MANUEL', 'FRANCISCO', 'ROLANDO', 'RICARDO', 'ROBERTO', 'REYNALDO', 'ALFREDO', 'DANILO', 'ERNESTO', 'DOMINADOR', 'SALVADOR', 'JUAN', 'PEDRO', 'SANTIAGO', 'FELIPE', 'TOMAS', 'MATEO', 'LUCAS', 'ANDRES', 'BARTOLOME'}
            
            # Check exact match first
            for name in female_names:
                if name in first_upper:
                    return 'Female'
            for name in male_names:
                if name in first_upper:
                    return 'Male'
            
            # Suffix check
            if first_upper.endswith(female_endings) or first_upper.endswith('A'):
                return 'Female'
            return 'Male'

        today = date.today()
        
        self.stdout.write('Generating Seniors with exact age distributions...')
        
        # 1300 records total:
        # - 15 for 78-79
        # - 839 for 80-99
        # - 446 for 100+
        age_ranges = []
        for _ in range(15):
            age_ranges.append(random.randint(78, 79))
        for _ in range(839):
            age_ranges.append(random.randint(80, 99))
        for _ in range(446):
            age_ranges.append(random.randint(100, 115))
            
        # Shuffle age ranges to mix ages naturally
        random.shuffle(age_ranges)

        seniors_created = []
        
        with transaction.atomic():
            for i, target_age in enumerate(age_ranges):
                # Pick unique name
                first, middle, last = unique_names[i]
                
                # Format to Title Case for UI presentation
                fn = first.title()
                mn = middle.title() if middle else ""
                ln = last.title()
                
                # Guess sex
                sex = guess_sex(fn)
                
                # QC District and Barangay selection
                district = random.choice(list(qc_districts.keys()))
                brgy = random.choice(qc_districts[district])
                
                # Calculate birth date safely
                try:
                    dob = today.replace(year=today.year - target_age) - timedelta(days=random.randint(0, 364))
                except ValueError:
                    dob = today.replace(year=today.year - target_age, month=2, day=28) - timedelta(days=random.randint(0, 364))
                
                # Unique OSCA ID (15-digit serial)
                serial_num = f"{i:015d}"
                osca_id = f"OSCA-2026-{serial_num}"
                
                # Civil status selection (Married, Widowed, Single, Separated, Divorced)
                civil_status = random.choices(['SINGLE', 'MARRIED', 'WIDOWED', 'SEPARATED', 'DIVORCED'], weights=[10, 45, 33, 8, 4])[0]
                
                spouse_name = ""
                spouse_citizenship = ""
                if civil_status in ['MARRIED', 'SEPARATED']:
                    # Generate a unique spouse first name from lists
                    spouse_first = random.choice(all_firsts).title()
                    spouse_name = f"{spouse_first} {ln}"
                    spouse_citizenship = "Filipino"
                
                primary_ben = f"{random.choice(all_firsts).title()} {ln}"
                reps = [{'name': f"{random.choice(all_firsts).title()} {random.choice(all_lasts).title()}", 'relation': 'Child'}]

                annex_data = {
                    'given_name': fn,
                    'middle_name': mn,
                    'last_name': ln,
                    'date_of_birth': dob.strftime('%Y-%m-%d'),
                    'sex': sex,
                    'civil_status': civil_status,
                    'spouse_name': spouse_name,
                    'spouse_citizenship': spouse_citizenship,
                    'res_house': str(random.randint(1, 200)),
                    'res_street': 'Street Name',
                    'res_brgy': brgy,
                    'res_district': district,
                    'res_city': 'Quezon City',
                    'res_prov': 'Metro Manila',
                    'osca_id_year': '2026',
                    'osca_id_serial': serial_num,
                    'primary_ben_name': primary_ben,
                    'primary_ben_rel': random.choice(['Child', 'Grandchild', 'Spouse']),
                    'utilization': random.sample(['FOOD', 'MEDICINE', 'HEALTH SERVICES', 'HOUSEHOLD NEEDS'], random.randint(1, 3)),
                    'contact_number': f"0917{random.randint(1000000, 9999999)}",
                    'reps': reps
                }
                
                # Deterministically seed system status
                status = random.choices(['ACTIVE', 'DECEASED', 'SUSPENDED', 'TRANSFERRED'], weights=[96, 2, 1, 1])[0]
                
                # Document slots: 92% have fully uploaded files, 8% have some missing
                has_docs = random.random() > 0.08
                psa_cert_file = f"/media/documents/psa_{i}.pdf" if has_docs else ""
                primary_id_file = f"/media/documents/osca_{i}.pdf" if (has_docs or random.random() > 0.5) else ""
                picture_2x2_file = f"/media/documents/photo_{i}.png" if (has_docs or random.random() > 0.5) else ""

                # Registration status: mostly APPROVED, with some PENDING_REVIEW, UNDER_REVIEW, and REJECTED
                registration_status = random.choices(['APPROVED', 'PENDING_REVIEW', 'UNDER_REVIEW', 'REJECTED'], weights=[94, 3, 1.5, 1.5])[0]

                s = Senior.objects.create(
                    first_name=fn,
                    last_name=ln,
                    middle_name=mn,
                    date_of_birth=dob,
                    osca_id=osca_id,
                    barangay=brgy,
                    status=status,
                    sex=sex,
                    civil_status=civil_status,
                    annex_a_data=annex_data,
                    psa_cert_file=psa_cert_file,
                    primary_id_file=primary_id_file,
                    picture_2x2_file=picture_2x2_file,
                    registration_status=registration_status
                )
                seniors_created.append(s)

        self.stdout.write('Generating Disbursements for active/approved seniors...')
        with transaction.atomic():
            for s in seniors_created:
                if s.registration_status != 'APPROVED':
                    continue
                    
                # 1. Generate Social Pension release details
                for q_name in ['Q1', 'Q2', 'Q3', 'Q4']:
                    Disbursement.objects.create(
                        senior=s,
                        disbursement_type='SOCIAL_PENSION',
                        amount=3000,
                        quarter=q_name,
                        year=2026,
                        status=random.choice(['PENDING', 'RELEASED']),
                        reference_number=f"SP-{q_name}-2026-{s.id}",
                        release_date=today if random.random() > 0.3 else None
                    )

                # 2. Birthday Milestone Release based on age
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
                        release_date=today if random.random() > 0.4 else None
                    )

        # Seed mock user login audits
        AuditLog.objects.create(
            user=admin_user,
            action='LOGIN',
            target_model='User',
            target_object_id=str(admin_user.id),
            changes_summary="User admin logged in successfully.",
            ip_address='192.168.1.1'
        )
        
        self.stdout.write(self.style.SUCCESS(f'Successfully seeded {len(seniors_created)} seniors and their disbursements!'))
