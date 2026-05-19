from datetime import date
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory, force_authenticate
from core.models import Senior, Disbursement
from core.views import DisbursementViewSet

class PayrollGenerationTestCase(TestCase):
    def setUp(self):
        # Create an admin user for authentication
        self.admin_user = User.objects.create_superuser(
            username='admin_test',
            email='admin@test.com',
            password='testpassword'
        )
        self.factory = APIRequestFactory()

    def test_payroll_generation_for_new_eligible_senior(self):
        """
        Verify that newly registered ACTIVE seniors who meet the age milestone
        criteria successfully get their milestone disbursements generated,
        and non-eligible seniors are excluded.
        """
        today = date.today()
        
        # 1. Senior 1: Exactly 80 years old today (Eligible)
        dob_80 = today.replace(year=today.year - 80)
        eligible_senior_1 = Senior.objects.create(
            first_name="Juan",
            last_name="Dela Cruz",
            date_of_birth=dob_80,
            osca_id="OSCA-80001",
            barangay="Barangay I",
            status="ACTIVE"
        )

        # 2. Senior 2: Exactly 100 years old today (Eligible)
        dob_100 = today.replace(year=today.year - 100)
        eligible_senior_2 = Senior.objects.create(
            first_name="Maria",
            last_name="Clara",
            date_of_birth=dob_100,
            osca_id="OSCA-10001",
            barangay="Barangay II",
            status="ACTIVE"
        )

        # 3. Senior 3: 79 years old today (Not eligible yet)
        dob_79 = today.replace(year=today.year - 79)
        non_eligible_senior = Senior.objects.create(
            first_name="Pedro",
            last_name="Penduko",
            date_of_birth=dob_79,
            osca_id="OSCA-79001",
            barangay="Barangay III",
            status="ACTIVE"
        )

        # 4. Senior 4: 80 years old but SUSPENDED/DECEASED (Not eligible)
        suspended_senior = Senior.objects.create(
            first_name="Jose",
            last_name="Rizal",
            date_of_birth=dob_80,
            osca_id="OSCA-80002",
            barangay="Barangay I",
            status="SUSPENDED"
        )

        # Trigger the generate_payroll POST request
        view = DisbursementViewSet.as_view({'post': 'generate_payroll'})
        request = self.factory.post('/api/disbursements/generate_payroll/', {'quarter': 'Q3'}, format='json')
        force_authenticate(request, user=self.admin_user)
        response = view(request)

        # Assert status code
        self.assertEqual(response.status_code, 200)
        
        # Verify 2 disbursements were created (for eligible_senior_1 and eligible_senior_2)
        self.assertEqual(response.data['created_count'], 2)
        
        # Check specific disbursements
        disbursements_80 = Disbursement.objects.filter(senior=eligible_senior_1)
        self.assertTrue(disbursements_80.exists())
        self.assertEqual(disbursements_80.first().amount, 10000)
        self.assertEqual(disbursements_80.first().status, 'PENDING')

        disbursements_100 = Disbursement.objects.filter(senior=eligible_senior_2)
        self.assertTrue(disbursements_100.exists())
        self.assertEqual(disbursements_100.first().amount, 100000)

        # Ensure no disbursements were created for non-eligible or suspended seniors
        self.assertFalse(Disbursement.objects.filter(senior=non_eligible_senior).exists())
        self.assertFalse(Disbursement.objects.filter(senior=suspended_senior).exists())

    def test_no_duplicate_payouts(self):
        """
        Verify that calling generate_payroll multiple times does not
        create duplicate disbursements for the same senior in the same year.
        """
        today = date.today()
        dob_85 = today.replace(year=today.year - 85)
        senior = Senior.objects.create(
            first_name="Andres",
            last_name="Bonifacio",
            date_of_birth=dob_85,
            osca_id="OSCA-85001",
            barangay="Barangay IV",
            status="ACTIVE"
        )

        view = DisbursementViewSet.as_view({'post': 'generate_payroll'})
        
        # First Run
        request1 = self.factory.post('/api/disbursements/generate_payroll/', {'quarter': 'Q3'}, format='json')
        force_authenticate(request1, user=self.admin_user)
        response1 = view(request1)
        self.assertEqual(response1.data['created_count'], 1)

        # Second Run
        request2 = self.factory.post('/api/disbursements/generate_payroll/', {'quarter': 'Q3'}, format='json')
        force_authenticate(request2, user=self.admin_user)
        response2 = view(request2)
        
        # Should not create duplicate
        self.assertEqual(response2.data['created_count'], 0)
        self.assertEqual(Disbursement.objects.filter(senior=senior).count(), 1)
