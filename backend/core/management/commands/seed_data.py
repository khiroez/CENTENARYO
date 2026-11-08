from django.core.management.base import BaseCommand
from core.models import Senior, Disbursement, UserProfile, AuditLog, AnomalyFlag, ReviewLog
from core.mortality_audit import BENCHMARKS, run_registry_audit, HIGH_SURVIVAL, EXCESS_MORTALITY
from django.contrib.auth.models import User
from django.db import transaction
from datetime import date, timedelta
from collections import Counter
import random
import os
import re


class Command(BaseCommand):
    help = (
        "Seeds the database with realistic QC OSCA senior registry data, balanced status "
        "distributions (ACTIVE, DECEASED, SUSPENDED, TRANSFERRED), and calibrated cohorts "
        "to test dynamic 3-sigma survival & mortality anomaly detection."
    )

    def handle(self, *args, **kwargs):
        random.seed(20261109)  # Deterministic, reproducible dataset

        self.stdout.write("Cleaning old data...")
        with transaction.atomic():
            AnomalyFlag.objects.all().delete()
            ReviewLog.objects.all().delete()
            Disbursement.objects.all().delete()
            Senior.objects.all().delete()
            AuditLog.objects.all().delete()

        # Ensure Admin user exists
        admin_user, _ = User.objects.get_or_create(
            username="admin",
            defaults={"first_name": "System", "last_name": "Administrator", "is_staff": True},
        )
        admin_user.set_password("admin123")
        admin_user.is_staff = True
        admin_user.save()
        UserProfile.objects.update_or_create(user=admin_user, defaults={"role": "ADMIN"})

        # Ensure Staff user exists
        staff_user, _ = User.objects.get_or_create(
            username="staff",
            defaults={"first_name": "OSCA", "last_name": "Encoder", "is_staff": False},
        )
        staff_user.set_password("staff123")
        staff_user.save()
        UserProfile.objects.update_or_create(user=staff_user, defaults={"role": "STAFF"})

        qc_districts = {
            "District 1": ['Vasra', 'Bagong Pag-asa', 'Sto. Cristo', 'Project 6', 'Ramon Magsaysay', 'Alicia', 'Bahay Toro', 'Katipunan', 'San Antonio', 'Veterans Village', 'Bungad', 'Phil-Am', 'West Triangle', 'Sta. Cruz', 'Nayong Kanluran', 'Paltok', 'Paraiso', 'Mariblo', 'Damayan', 'Del Monte', 'Masambong', 'Talayan', 'Sto. Domingo', 'Siena', 'St. Peter', 'San Jose', 'Manresa', 'Damar', 'Pag-ibig sa Nayon', 'Balingasa', 'Sta. Teresita', 'San Isidro Labrador', 'Paang Bundok', 'Salvacion', 'N.S Amoranto', 'Maharlika', 'Lourdes'],
            "District 2": ['Bagong Silangan', 'Batasan Hills', 'Commonwealth', 'Holy Spirit', 'Payatas'],
            "District 3": ['Silangan', 'Socorro', 'E. Rodriguez', 'West Kamias', 'East Kamias', 'Quirino 2-A', 'Quirino 2-B', 'Quirino 2-C', 'Quirino 3-A', 'Claro (Quirino 3-B)', 'Duyan-Duyan', 'Amihan', 'Matandang Balara', 'Pansol', 'Loyola Heights', 'San Roque', 'Mangga', 'Masagana', 'Villa Maria Clara', 'Bayanihan', 'Camp Aguinaldo', 'White Plains', 'Libis', 'Ugong Norte', 'Bagumbayan', 'Blue Ridge A', 'Blue Ridge B', 'St. Ignatius', 'Milagrosa', 'Escopa I', 'Escopa II', 'Escopa III', 'Escopa IV', 'Marilag', 'Bagumbuhay', 'Tagumpay', 'Dioquino Zobel'],
            "District 4": ['Sacred Heart', 'Laging Handa', 'Obrero', 'Paligsahan', 'Roxas', 'Kamuning', 'South Triangle', 'Pinagkaisahan', 'Immaculate Concepcion', 'San Martin De Porres', 'Kaunlaran', 'Bagong Lipunan ng Crame', 'Horseshoe', 'Valencia', 'Tatalon', 'Kalusugan', 'Kristong Hari', 'Damayang Lagi', 'Mariana', 'Doña Imelda', 'Santol', 'Sto. Niño', 'San Isidro Galas', 'Doña Aurora', 'Don Manuel', 'Doña Josefa', 'UP Village', 'Old Capitol Site', 'UP Campus', 'San Vicente', 'Teachers Village East', 'Teachers Village West', 'Central', 'Pinyahan', 'Malaya', 'Sikatuna Village', 'Botocan', 'Krus Na Ligas'],
            "District 5": ['Bagbag', 'Capri', 'Greater Lagro', 'Gulod', 'Kaligayahan', 'Nagkaisang Nayon', 'North Fairview', 'Novaliches Proper', 'Pasong Putik Proper', 'San Agustin', 'San Bartolome', 'Sta. Lucia', 'Sta. Monica', 'Fairview'],
            "District 6": ['Apolonio Samson', 'Baesa', 'Balon Bato', 'Culiat', 'New Era', 'Pasong Tamo', 'Sangandaan', 'Tandang Sora', 'Unang Sigaw', 'Sauyo', 'Talipapa'],
        }
        brgy_to_district = {b: d for d, brgys in qc_districts.items() for b in brgys}

        # Load unique names pool
        names_file_path = r"d:\codes\cen4\extracted_names_839.md"
        parsed_names = []
        if os.path.exists(names_file_path):
            with open(names_file_path, "r", encoding="utf-8") as f:
                for line in f:
                    match = re.match(r"^\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|$", line.strip())
                    if match:
                        parsed_names.append((match.group(2).strip(), match.group(3).strip(), match.group(1).strip()))
        if not parsed_names:
            parsed_names = [
                ("Nenita", "Costin", "Diaz"), ("Ramon", "Perez", "Abalos"),
                ("Valentina", "Panfilo", "Dabi"), ("Rosa", "Ngo", "Lao"),
                ("Maria", "Sebastian", "Abuyuan"), ("Eduardo", "Santos", "Reyes"),
                ("Corazon", "Aquino", "Cruz"), ("Alberto", "Mendoza", "Bautista"),
            ]

        seen_names = set()
        unique_names = []
        for first, middle, last in parsed_names:
            key = (first.upper(), middle.upper(), last.upper())
            if key not in seen_names:
                seen_names.add(key)
                unique_names.append((first, middle, last))

        all_firsts = list({n[0] for n in unique_names})
        all_middles = list({n[1] for n in unique_names if n[1]}) or ["Santos", "Reyes", "Cruz"]
        all_lasts = list({n[2] for n in unique_names})

        while len(unique_names) < 2500:
            first = random.choice(all_firsts)
            middle = random.choice(all_middles)
            last = random.choice(all_lasts)
            key = (first.upper(), middle.upper(), last.upper())
            if key not in seen_names:
                seen_names.add(key)
                unique_names.append((first, middle, last))

        def guess_sex(first_name):
            first_upper = first_name.upper()
            female_endings = ("ITA", "INA", "ILA", "ELA", "CIA", "OSA", "RIA", "ISA", "IDA", "DRA", "ORA", "NZA", "LZA", "NDA", "RTA", "ICA")
            female_names = {"MARIA", "LUZ", "CORAZON", "ESTRELLA", "FE", "CARMEN", "TERESA", "JOSEFINA", "LOURDES", "VIRGINIA", "ESPERANZA", "IMELDA", "ROSARIO", "MERCEDES", "CONCEPCION", "BEATRIZ", "DOLORES", "GLORIA", "PAZ", "SOCORRO", "PILAR", "NIEVES", "REMEDIOS", "CONSUELO", "ANTONINA", "ISABELITA", "LETECIA", "JULITA", "LUISA", "EMILIA"}
            male_names = {"RAMON", "PERFECTO", "EDUARDO", "MARCELINO", "FORTUNATO", "ALBERTO", "PACIFICO", "CARLITO", "DOMINGO", "FLORENCIO", "JOSE", "ANTONIO", "MANUEL", "FRANCISCO", "ROLANDO", "RICARDO", "ROBERTO", "REYNALDO", "ALFREDO", "DANILO", "ERNESTO", "DOMINADOR", "SALVADOR", "JUAN", "PEDRO", "SANTIAGO", "FELIPE", "TOMAS", "MATEO", "LUCAS", "ANDRES", "BARTOLOME"}
            for name in female_names:
                if name in first_upper:
                    return "Female"
            for name in male_names:
                if name in first_upper:
                    return "Male"
            if first_upper.endswith(female_endings) or first_upper.endswith("A"):
                return "Female"
            return "Male"

        today = date.today()
        cycle_start = today - timedelta(days=365)

        def dob_for_cycle_milestone(milestone):
            """Returns a birth date placing the senior squarely inside `milestone` at cycle_start."""
            if milestone == "70s":
                age_at_start = random.randint(78, 79)
            elif milestone == "80s":
                age_at_start = random.randint(80, 88)
            elif milestone == "90s":
                age_at_start = random.randint(90, 98)
            else:  # 100+
                age_at_start = random.randint(100, 106)
            base_year = cycle_start.year - age_at_start
            return date(base_year, random.randint(1, 12), random.randint(1, 28))

        # -------------------------------------------------------------------------
        # COHORT PLANNER
        # Each entry is (barangay, milestone, n_total, d_deaths, n_suspended, n_transferred)
        # -------------------------------------------------------------------------
        cohort_specs = []

        # 1. DELIBERATE ANOMALY TEST CASES (6 targeted cases covering every status/level)
        # Case A1: Brgy. Commonwealth (90s) -> HIGH SURVIVAL (N=30, D=0; 100% vs max 98.01%)
        cohort_specs.append(("Commonwealth", "90s", 30, 0, 2, 2))
        # Case A2: Brgy. Batasan Hills (80s) -> HIGH SURVIVAL (N=80, D=0; 100% vs max 98.90%)
        cohort_specs.append(("Batasan Hills", "80s", 80, 0, 4, 3))
        # Case A3: Brgy. Payatas (100+) -> HIGH SURVIVAL (N=12, D=0; 100% vs max 98.08%)
        cohort_specs.append(("Payatas", "100+", 12, 0, 1, 1))

        # Case B1: Brgy. Holy Spirit (80s) -> EXCESS MORTALITY (N=30, D=12; 60% vs min 70.20%)
        cohort_specs.append(("Holy Spirit", "80s", 30, 12, 2, 2))
        # Case B2: Brgy. Bagong Silangan (90s) -> EXCESS MORTALITY (N=20, D=12; 40% vs min 44.58%)
        cohort_specs.append(("Bagong Silangan", "90s", 20, 12, 2, 1))

        # Case C1: District 4 Small Barangays (90s) -> DISTRICT-POOLED HIGH SURVIVAL
        # 15 small barangays in District 4 each with N=2, D=0 (N<5 individually -> pooled N=30, D=0)
        d4_small_brgys = qc_districts["District 4"][:15]
        for b in d4_small_brgys:
            cohort_specs.append((b, "90s", 2, 0, 0, 0))

        # 2. NORMAL BARANGAY COHORTS (Deaths calibrated to match baseline mu_m -> NORMAL status)
        normal_barangays = [
            ("Commonwealth", "80s", 45),
            ("Commonwealth", "70s", 25),
            ("Batasan Hills", "90s", 20),
            ("Batasan Hills", "70s", 20),
            ("Payatas", "80s", 35),
            ("Payatas", "90s", 16),
            ("Holy Spirit", "90s", 16),
            ("Bagong Silangan", "80s", 32),
            ("Tandang Sora", "80s", 36),
            ("Tandang Sora", "90s", 16),
            ("Matandang Balara", "80s", 30),
            ("Matandang Balara", "90s", 15),
            ("Fairview", "80s", 32),
            ("Fairview", "90s", 15),
            ("Novaliches Proper", "80s", 28),
            ("Novaliches Proper", "90s", 15),
            ("Bahay Toro", "80s", 28),
            ("Bahay Toro", "90s", 15),
            ("Baesa", "80s", 26),
            ("Baesa", "90s", 15),
            ("Culiat", "80s", 25),
            ("Pasong Tamo", "80s", 25),
            ("Greater Lagro", "80s", 25),
            ("Gulod", "80s", 24),
            ("Nagkaisang Nayon", "80s", 24),
            ("Bagong Pag-asa", "80s", 24),
            ("Project 6", "80s", 22),
            ("Loyola Heights", "80s", 22),
            ("Pansol", "80s", 22),
            ("Socorro", "80s", 20),
            ("Kamuning", "80s", 20),
            ("Tatalon", "80s", 25),
            ("Krus Na Ligas", "80s", 20),
        ]
        for brgy, milestone, n_val in normal_barangays:
            mu_m = BENCHMARKS[milestone]
            expected_deaths = int(round(n_val * mu_m))
            n_susp = random.randint(3, 5)
            n_trans = random.randint(3, 5)
            cohort_specs.append((brgy, milestone, n_val, expected_deaths, n_susp, n_trans))

        # 3. SMALL BARANGAY POOLS IN DISTRICTS 1, 3, 5, 6 WITH NORMAL MORTALITY
        for dist_name in ["District 1", "District 3", "District 5", "District 6"]:
            small_brgys = [b for b in qc_districts[dist_name] if b not in {x[0] for x in cohort_specs}][:8]
            # Pool of 8 barangays x 3 seniors = 24 seniors in 80s with ~3 deaths (12.5% mortality -> NORMAL)
            deaths_left = 3
            for idx_b, b in enumerate(small_brgys):
                d_here = 1 if idx_b < deaths_left else 0
                cohort_specs.append((b, "80s", 3, d_here, 1, 1))

        # Controlled shared representatives (2 syndicate test cases of 3 seniors each)
        syndicate_reps = [
            "MARCO ANTONIO DELA CRUZ",
            "VERONICA SANTOS MENDOZA",
        ]

        seniors_to_create = []
        name_idx = 0

        def build_senior(brgy, dob, status, reg_status="APPROVED", force_rep=None):
            nonlocal name_idx
            first, middle, last = unique_names[name_idx]
            name_idx += 1

            fn = first.title()
            mn = middle.title() if middle else ""
            ln = last.title()
            sex = guess_sex(fn)
            district = brgy_to_district.get(brgy, "District 1")
            osca_id = f"{88899900000000 + name_idx:014d}"
            civil_status = random.choices(
                ["SINGLE", "MARRIED", "WIDOWED", "SEPARATED"],
                weights=[12, 42, 38, 8],
            )[0]

            spouse_name = f"{random.choice(all_firsts).title()} {ln}" if civil_status in ["MARRIED", "SEPARATED"] else ""
            spouse_citizenship = "Filipino" if spouse_name else ""
            rep_name = force_rep or f"{random.choice(all_firsts).title()} {ln} Jr."
            crs_copy_number = f"08621-A8-003AOQ-{name_idx:05d}-BI005"

            dod = None
            if status == "DECEASED":
                dod = today - timedelta(days=random.randint(15, 340))

            annex_data = {
                "given_name": fn,
                "middle_name": mn,
                "last_name": ln,
                "date_of_birth": dob.strftime("%Y-%m-%d"),
                "sex": sex,
                "civil_status": civil_status,
                "crs_copy_number": crs_copy_number,
                "spouse_name": spouse_name,
                "spouse_citizenship": spouse_citizenship,
                "res_house": str(random.randint(1, 250)),
                "res_street": "Mabini St.",
                "res_brgy": brgy,
                "res_district": district,
                "res_city": "Quezon City",
                "res_prov": "Metro Manila",
                "utilization": random.sample(["FOOD", "MEDICINE", "HEALTH SERVICES", "HOUSEHOLD NEEDS"], random.randint(1, 3)),
                "contact_number": f"0917{random.randint(1000000, 9999999)}",
                "reps": [{"name": rep_name, "relation": "Child"}],
            }

            return Senior(
                first_name=fn,
                last_name=ln,
                middle_name=mn,
                date_of_birth=dob,
                osca_id=osca_id,
                barangay=brgy,
                status=status,
                sex=sex,
                civil_status=civil_status,
                is_indigent=True,
                annex_a_data=annex_data,
                psa_cert_file="",
                primary_id_file="",
                picture_2x2_file="",
                date_of_death=dod,
                death_cert_file="",
                registration_status=reg_status,
            )

        self.stdout.write("Building calibrated senior cohorts across Quezon City barangays...")
        for brgy, milestone, n_total, d_deaths, n_susp, n_trans in cohort_specs:
            n_active = max(0, n_total - d_deaths)
            for _ in range(n_active):
                seniors_to_create.append(build_senior(brgy, dob_for_cycle_milestone(milestone), "ACTIVE"))
            for _ in range(d_deaths):
                seniors_to_create.append(build_senior(brgy, dob_for_cycle_milestone(milestone), "DECEASED"))
            for _ in range(n_susp):
                seniors_to_create.append(build_senior(brgy, dob_for_cycle_milestone(milestone), "SUSPENDED"))
            for _ in range(n_trans):
                seniors_to_create.append(build_senior(brgy, dob_for_cycle_milestone(milestone), "TRANSFERRED"))

        # Add 24 upcoming seniors (aged 78-79 today) and 12 pending-review applications for Review Queue testing
        for idx_u in range(24):
            brgy = random.choice(qc_districts["District 3"])
            dob_upcoming = date(today.year - random.choice([78, 79]), random.randint(1, 12), random.randint(1, 28))
            rep_override = syndicate_reps[idx_u // 3] if idx_u < 6 else None
            seniors_to_create.append(build_senior(brgy, dob_upcoming, "ACTIVE", "APPROVED", force_rep=rep_override))

        for _ in range(12):
            brgy = random.choice(qc_districts["District 1"])
            dob_pending = date(today.year - random.randint(80, 92), random.randint(1, 12), random.randint(1, 28))
            seniors_to_create.append(build_senior(brgy, dob_pending, "ACTIVE", "PENDING_REVIEW"))

        with transaction.atomic():
            Senior.objects.bulk_create(seniors_to_create)

        all_seniors = list(Senior.objects.all())
        status_counts = Counter(s.status for s in all_seniors)
        self.stdout.write(f"Created {len(all_seniors)} seniors -> {dict(status_counts)}")

        # Create disbursements for approved records
        self.stdout.write("Generating Disbursements...")
        disbursements_to_create = []
        for s in all_seniors:
            if s.registration_status != "APPROVED":
                continue
            for q_name in ["Q1", "Q2"]:
                disbursements_to_create.append(
                    Disbursement(
                        senior=s,
                        disbursement_type="SOCIAL_PENSION",
                        amount=3000,
                        quarter=q_name,
                        year=2026,
                        status="RELEASED" if s.status == "ACTIVE" else "PENDING",
                        reference_number=f"SP-{q_name}-2026-{s.id}",
                        release_date=today - timedelta(days=random.randint(5, 90)) if s.status == "ACTIVE" else None,
                    )
                )
            dob = s.date_of_birth
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            if age >= 100 or age in [80, 85, 90, 95]:
                amt = 100000 if age >= 100 else 10000
                disbursements_to_create.append(
                    Disbursement(
                        senior=s,
                        disbursement_type="MILESTONE_GIFT",
                        amount=amt,
                        quarter="Q1",
                        year=2026,
                        status="RELEASED" if s.status == "ACTIVE" and random.random() > 0.3 else "PENDING",
                        reference_number=f"ECA-2026-{s.id}-{age}",
                        release_date=today - timedelta(days=random.randint(10, 60)) if s.status == "ACTIVE" else None,
                    )
                )

        with transaction.atomic():
            Disbursement.objects.bulk_create(disbursements_to_create)

        # Pre-compute initial AnomalyFlag records using the dynamic 3-sigma audit
        rows = list(Senior.objects.values("id", "status", "barangay", "date_of_birth", "date_of_death"))
        audit_results = run_registry_audit(rows, today=today)
        flags_to_create = []
        flagged_cohorts = [r for r in audit_results if r["status"] in (HIGH_SURVIVAL, EXCESS_MORTALITY)]

        for r in flagged_cohorts:
            is_district = r.get("level") == "DISTRICT"
            pooled_list = r.get("pooled_barangays", [])
            scope_note = f" [District Pool: {len(pooled_list)} small barangays combined]" if is_district and pooled_list else ""
            if r["status"] == HIGH_SURVIVAL:
                reason = (
                    f"Suspiciously High Survival Rate ({r['milestone']}): {r['actual']}% survived "
                    f"(N={r['n']}, deaths={r['d']}) vs. expected {r['expected']}%, upper limit {r['max']}%{scope_note}."
                )
            else:
                reason = (
                    f"Excess Mortality / Low Survival Rate ({r['milestone']}): {r['actual']}% survived "
                    f"(N={r['n']}, deaths={r['d']}) vs. expected {r['expected']}%, lower limit {r['min']}%{scope_note}."
                )
            band = max(r["max"] - r["expected"], 0.01)
            distance = abs(r["actual"] - r["expected"]) / band
            confidence = round(min(0.99, 0.80 + 0.05 * (distance - 1)), 2)
            for sid in r["flag_ids"]:
                flags_to_create.append(AnomalyFlag(senior_id=sid, flag_reason=reason, confidence_score=confidence))

        with transaction.atomic():
            AnomalyFlag.objects.bulk_create(flags_to_create)

        AuditLog.objects.create(
            user=admin_user,
            action="LOGIN",
            target_model="User",
            target_object_id=str(admin_user.id),
            changes_summary="Administrator seeded calibrated QC OSCA dataset.",
            ip_address="127.0.0.1",
        )

        self.stdout.write(self.style.SUCCESS(
            f"Successfully seeded {len(all_seniors)} seniors, {len(disbursements_to_create)} disbursements, "
            f"and {len(flagged_cohorts)} anomalous cohorts ({len(flags_to_create)} individual flags)!"
        ))
