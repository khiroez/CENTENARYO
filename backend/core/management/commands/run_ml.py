import pandas as pd
from datetime import date
from django.core.management.base import BaseCommand
from django.db.models import Sum, Count, Avg
from core.models import Senior, Disbursement, AnomalyFlag, AuditLog
from sklearn.ensemble import IsolationForest

class Command(BaseCommand):
    help = 'Runs the Isolation Forest ML model to detect anomalies in Senior Records and Disbursements'

    def handle(self, *args, **kwargs):
        self.stdout.write("Gathering data for Machine Learning model...")

        # 1. Kunin lahat ng Seniors at i-compute ang features nila
        seniors = Senior.objects.all()
        if not seniors.exists():
            self.stdout.write(self.style.WARNING("No seniors found in the database. Run seed_data first."))
            return

        data = []
        today = date.today()

        for senior in seniors:
            # Edad (Age) Computation gamit ang date_of_birth
            age = today.year - senior.date_of_birth.year - ((today.month, today.day) < (senior.date_of_birth.month, senior.date_of_birth.day))
            
            # Pagsama-samahin ang data mula sa Disbursements
            disbursements = Disbursement.objects.filter(senior=senior)
            total_amount = disbursements.aggregate(Sum('amount'))['amount__sum'] or 0
            count_disbursements = disbursements.count()
            avg_amount = total_amount / count_disbursements if count_disbursements > 0 else 0

            data.append({
                'id': senior.id,
                'age': age,
                'total_amount': float(total_amount),
                'count_disbursements': count_disbursements,
                'avg_amount': float(avg_amount),
                'is_indigent': 1 if senior.is_indigent else 0
            })

        df = pd.DataFrame(data)

        self.stdout.write(f"Data gathered for {len(df)} seniors. Running Isolation Forest Engine...")

        # 2. Piliin ang mga features (variables) na gagamitin para maghanap ng Anomaly
        features = ['age', 'total_amount', 'count_disbursements', 'avg_amount']
        X = df[features]

        # 3. I-train ang Isolation Forest (Unsupervised Learning)
        # contamination = expected na porsyento ng anomalies sa buong population (5%)
        model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
        model.fit(X)
        
        # Predict: -1 = Anomaly/Outlier, 1 = Normal
        predictions = model.predict(X)
        
        # Kunin ang raw anomaly scores (mas mababa = mas abnormal)
        scores = model.decision_function(X)
        
        # I-normalize ang scores (0 to 1 range) para sa 'risk_score' field natin.
        # Gusto natin na kapag mas mataas ang risk_score, mas delikado. Kaya i-invert natin.
        df['anomaly'] = predictions
        df['raw_score'] = scores
        max_score = df['raw_score'].max()
        min_score = df['raw_score'].min()
        
        if max_score != min_score:
            df['risk_score'] = 1 - ((df['raw_score'] - min_score) / (max_score - min_score))
        else:
            df['risk_score'] = 0.0

        # 4. I-save pabalik sa Database ang results
        self.stdout.write("Updating database with Machine Learning results...")
        
        anomalies_detected = 0
        
        for index, row in df.iterrows():
            senior = Senior.objects.get(id=row['id'])
            
            # I-update ang risk score ng senior para makita sa Next.js Dashboard
            senior.risk_score = round(row['risk_score'], 2)
            senior.save(update_fields=['risk_score'])
            
            # Kung hinusgahan ng ML na Anomaly ito (prediction == -1) at mataas ang risk score:
            if row['anomaly'] == -1 and row['risk_score'] > 0.60:
                anomalies_detected += 1
                
                # Bumuo ng rason base sa nakitang data ng ML
                reason = "AI Detected Anomaly: "
                factors = []
                if row['age'] > 105:
                    factors.append(f"Unusual age ({row['age']} yrs old)")
                if row['total_amount'] > 20000:
                    factors.append(f"Excessive disbursement totals (PHP {row['total_amount']})")
                if row['count_disbursements'] > 4:
                    factors.append(f"Suspicious claim frequency ({row['count_disbursements']} claims)")
                
                if not factors:
                    factors.append("Multivariate outlier pattern in financial demographics")
                    
                reason += " | ".join(factors)

                # Siguraduhing walang duplicate na Pending flag itong taong ito
                existing_flag = AnomalyFlag.objects.filter(senior=senior, is_resolved=False).exists()
                if not existing_flag:
                    AnomalyFlag.objects.create(
                        senior=senior,
                        flag_reason=reason,
                        confidence_score=round(row['risk_score'], 2), # 0.0 to 1.0 based on models.py
                        is_resolved=False
                    )

        self.stdout.write(self.style.SUCCESS(f"\n[AI BRAIN SUCCESS] Machine Learning scan completed! Found {anomalies_detected} highly suspicious records."))
        
        # I-log ang event na ito sa AuditLog para sa transparency
        AuditLog.objects.create(
            user=None, # System action ito kaya walang specific user
            activity=f"ML_ANOMALY_SCAN: Analyzed {len(df)} records. Found {anomalies_detected} anomalies.",
            status="COMPLETED"
        )
