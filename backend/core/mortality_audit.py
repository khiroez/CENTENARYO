"""
Dynamic Senior Mortality / Survival Anomaly Audit.

Replaces the old static rule ("2+ seniors aged 90+ and 0 deaths in the barangay")
with a binomial 3-sigma test whose thresholds are a function of cohort size N:

    SE      = sqrt(mu_m * (1 - mu_m) / N)
    S_max   = min(1, mu_s + 3*SE)   -> above: FLAG_SUSPICIOUSLY_HIGH_SURVIVAL (ghost seniors)
    S_min   = max(0, mu_s - 3*SE)   -> below: FLAG_EXCESS_MORTALITY (purge / data error / health event)

Small barangay cohorts (N < 5) are pooled per district + milestone and tested again;
anything still under N < 5 is reported as INSUFFICIENT_SAMPLE_SIZE instead of being flagged.
"""
import math
from datetime import date, timedelta

# Baseline annual mortality probabilities (PSA / OSCA actuarial reference).
BENCHMARKS = {
    "70s": 0.055,
    "80s": 0.120,
    "90s": 0.260,
    "100+": 0.450,
}

MIN_SAMPLE_SIZE = 5
SIGMA = 3

# Quezon City barangay -> legislative district (mirrors the frontend registry form list)
QC_DISTRICTS = {
    "District 1": ['Vasra', 'Bagong Pag-asa', 'Sto. Cristo', 'Project 6', 'Ramon Magsaysay', 'Alicia', 'Bahay Toro', 'Katipunan', 'San Antonio', 'Veterans Village', 'Bungad', 'Phil-Am', 'West Triangle', 'Sta. Cruz', 'Nayong Kanluran', 'Paltok', 'Paraiso', 'Mariblo', 'Damayan', 'Del Monte', 'Masambong', 'Talayan', 'Sto. Domingo', 'Siena', 'St. Peter', 'San Jose', 'Manresa', 'Damar', 'Pag-ibig sa Nayon', 'Balingasa', 'Sta. Teresita', 'San Isidro Labrador', 'Paang Bundok', 'Salvacion', 'N.S Amoranto', 'Maharlika', 'Lourdes'],
    "District 2": ['Bagong Silangan', 'Batasan Hills', 'Commonwealth', 'Holy Spirit', 'Payatas'],
    "District 3": ['Silangan', 'Socorro', 'E. Rodriguez', 'West Kamias', 'East Kamias', 'Quirino 2-A', 'Quirino 2-B', 'Quirino 2-C', 'Quirino 3-A', 'Claro (Quirino 3-B)', 'Duyan-Duyan', 'Amihan', 'Matandang Balara', 'Pansol', 'Loyola Heights', 'San Roque', 'Mangga', 'Masagana', 'Villa Maria Clara', 'Bayanihan', 'Camp Aguinaldo', 'White Plains', 'Libis', 'Ugong Norte', 'Bagumbayan', 'Blue Ridge A', 'Blue Ridge B', 'St. Ignatius', 'Milagrosa', 'Escopa I', 'Escopa II', 'Escopa III', 'Escopa IV', 'Marilag', 'Bagumbuhay', 'Tagumpay', 'Dioquino Zobel'],
    "District 4": ['Sacred Heart', 'Laging Handa', 'Obrero', 'Paligsahan', 'Roxas', 'Kamuning', 'South Triangle', 'Pinagkaisahan', 'Immaculate Concepcion', 'San Martin De Porres', 'Kaunlaran', 'Bagong Lipunan ng Crame', 'Horseshoe', 'Valencia', 'Tatalon', 'Kalusugan', 'Kristong Hari', 'Damayang Lagi', 'Mariana', 'Doña Imelda', 'Santol', 'Sto. Niño', 'San Isidro Galas', 'Doña Aurora', 'Don Manuel', 'Doña Josefa', 'UP Village', 'Old Capitol Site', 'UP Campus', 'San Vicente', 'Teachers Village East', 'Teachers Village West', 'Central', 'Pinyahan', 'Malaya', 'Sikatuna Village', 'Botocan', 'Krus Na Ligas'],
    "District 5": ['Bagbag', 'Capri', 'Greater Lagro', 'Gulod', 'Kaligayahan', 'Nagkaisang Nayon', 'North Fairview', 'Novaliches Proper', 'Pasong Putik Proper', 'San Agustin', 'San Bartolome', 'Sta. Lucia', 'Sta. Monica', 'Fairview'],
    "District 6": ['Apolonio Samson', 'Baesa', 'Balon Bato', 'Culiat', 'New Era', 'Pasong Tamo', 'Sangandaan', 'Tandang Sora', 'Unang Sigaw', 'Sauyo', 'Talipapa'],
}
_BRGY_TO_DISTRICT = {b.strip().lower(): d for d, brgys in QC_DISTRICTS.items() for b in brgys}


def district_for_barangay(name):
    return _BRGY_TO_DISTRICT.get((name or "").strip().lower())

NORMAL = "NORMAL"
HIGH_SURVIVAL = "FLAG_SUSPICIOUSLY_HIGH_SURVIVAL"
EXCESS_MORTALITY = "FLAG_EXCESS_MORTALITY"
INSUFFICIENT = "INSUFFICIENT_SAMPLE_SIZE"


def milestone_for_age(age):
    if age >= 100:
        return "100+"
    if age >= 90:
        return "90s"
    if age >= 80:
        return "80s"
    if age >= 70:
        return "70s"
    return None


def age_on(dob, ref):
    return ref.year - dob.year - ((ref.month, ref.day) < (dob.month, dob.day))


def audit_cohort(milestone, n, d):
    """Pure statistical test for one barangay/milestone cohort. Rates are returned as percentages."""
    mu_m = BENCHMARKS[milestone]
    mu_s = 1.0 - mu_m

    if n <= 0:
        return {
            "status": INSUFFICIENT, "actual": 0.0, "expected": round(mu_s * 100, 2),
            "min": 0.0, "max": 100.0, "notes": "No registered seniors in this cohort.",
        }

    actual = (n - d) / n

    if n < MIN_SAMPLE_SIZE:
        return {
            "status": INSUFFICIENT, "actual": round(actual * 100, 2), "expected": round(mu_s * 100, 2),
            "min": 0.0, "max": 100.0,
            "notes": "Sample size too small for statistical test. Perform physical home verification or aggregate to district level.",
        }

    margin = SIGMA * math.sqrt(mu_m * (1 - mu_m) / n)
    s_max = min(1.0, mu_s + margin)
    s_min = max(0.0, mu_s - margin)

    status, notes = NORMAL, None
    if actual > s_max:
        status = HIGH_SURVIVAL
        notes = "Actual survival exceeds expected upper limit. Investigate unrecorded deaths / potential ghost beneficiaries."
    elif actual < s_min:
        status = EXCESS_MORTALITY
        notes = "Actual survival falls below expected lower limit. Check for registry purging anomalies or localized health events."

    return {
        "status": status,
        "actual": round(actual * 100, 2),
        "expected": round(mu_s * 100, 2),
        "min": round(s_min * 100, 2),
        "max": round(s_max * 100, 2),
        "notes": notes,
    }


def run_registry_audit(seniors, today=None, cycle_days=365):
    """
    seniors: iterable of dicts with id, status, barangay, date_of_birth, date_of_death.

    Audit cycle = the last `cycle_days` days. A senior belongs to a cohort (N) if they were
    alive at the start of the cycle (ACTIVE, or DECEASED with a death date inside the cycle);
    cohort = age milestone at cycle start. D = deaths recorded inside the cycle.
    Deceased records without a death date cannot be placed in time and are excluded.

    Returns a list of cohort results (one per barangay+milestone), each carrying the
    senior IDs that should be flagged when the cohort is anomalous.
    """
    today = today or date.today()
    cycle_start = today - timedelta(days=cycle_days)

    cohorts = {}  # (barangay, milestone) -> {"active": [ids], "died": [ids]}
    for s in seniors:
        dob = s.get("date_of_birth")
        brgy = s.get("barangay")
        if not dob or not brgy:
            continue

        status = s.get("status")
        dod = s.get("date_of_death")
        if status == "DECEASED":
            if not dod or dod < cycle_start or dod > today:
                continue
            died = True
        elif status == "ACTIVE":
            died = False
        else:
            continue  # TRANSFERRED / SUSPENDED are outside the exposure population

        milestone = milestone_for_age(age_on(dob, cycle_start))
        if not milestone:
            continue

        bucket = cohorts.setdefault((brgy, milestone), {"active": [], "died": []})
        bucket["died" if died else "active"].append(s["id"])

    results = []
    small_pools = {}  # (district, milestone) -> pooled small barangay cohorts
    for (brgy, milestone), b in cohorts.items():
        d = len(b["died"])
        n = len(b["active"]) + d
        r = audit_cohort(milestone, n, d)
        r.update({"level": "BARANGAY", "barangay": brgy, "district": district_for_barangay(brgy),
                  "milestone": milestone, "n": n, "d": d})
        r["flag_ids"] = _flag_ids(r["status"], b)
        results.append(r)

        # Barangay too small to test on its own -> pool it into its district for the same milestone
        if r["status"] == INSUFFICIENT and n > 0 and r["district"]:
            pool = small_pools.setdefault((r["district"], milestone),
                                          {"active": [], "died": [], "barangays": []})
            pool["active"] += b["active"]
            pool["died"] += b["died"]
            pool["barangays"].append(brgy)

    # District-level fallback test. Only the small barangay cohorts are pooled, so seniors
    # already tested at barangay level are never counted twice.
    for (district, milestone), p in small_pools.items():
        d = len(p["died"])
        n = len(p["active"]) + d
        r = audit_cohort(milestone, n, d)
        r.update({"level": "DISTRICT", "barangay": f"{district} (pooled)", "district": district,
                  "pooled_barangays": sorted(p["barangays"]),
                  "milestone": milestone, "n": n, "d": d})
        r["flag_ids"] = _flag_ids(r["status"], p)
        if r["status"] == INSUFFICIENT:
            r["notes"] = "Still below minimum sample even after district pooling. Physical home verification required."
        results.append(r)
    return results


def _flag_ids(status, bucket):
    if status == HIGH_SURVIVAL:
        return list(bucket["active"])
    if status == EXCESS_MORTALITY:
        return list(bucket["died"])
    return []

