"""
Dynamic Senior Mortality / Survival Anomaly Audit.

Replaces the old static rule ("2+ seniors aged 90+ and 0 deaths in the barangay")
with a binomial 3-sigma test whose thresholds are a function of cohort size N:

    SE      = sqrt(mu_m * (1 - mu_m) / N)
    S_max   = min(1, mu_s + 3*SE)   -> above: FLAG_SUSPICIOUSLY_HIGH_SURVIVAL (ghost seniors)
    S_min   = max(0, mu_s - 3*SE)   -> below: FLAG_EXCESS_MORTALITY (purge / data error / health event)

Small cohorts (N < 5) are reported as INSUFFICIENT_SAMPLE_SIZE instead of being flagged.
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
    for (brgy, milestone), b in cohorts.items():
        d = len(b["died"])
        n = len(b["active"]) + d
        r = audit_cohort(milestone, n, d)
        r.update({"barangay": brgy, "milestone": milestone, "n": n, "d": d})
        if r["status"] == HIGH_SURVIVAL:
            r["flag_ids"] = b["active"]
        elif r["status"] == EXCESS_MORTALITY:
            r["flag_ids"] = b["died"]
        else:
            r["flag_ids"] = []
        results.append(r)
    return results
