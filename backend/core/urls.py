from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

# Ginagamit ang DefaultRouter ng DRF para mabilis ma-generate ang lahat ng CRUD endpoints
router = DefaultRouter()
router.register(r'seniors', views.SeniorViewSet, basename='senior')
router.register(r'disbursements', views.DisbursementViewSet, basename='disbursement')
router.register(r'anomalies', views.AnomalyFlagViewSet)
router.register(r'auditlogs', views.AuditLogViewSet, basename='auditlog')

urlpatterns = [
    # JWT Authentication Endpoints
    path('token/', views.CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Current User Endpoint (returns role for RBAC)
    path('me/', views.get_current_user, name='current_user'),
    path('logout/', views.logout_user, name='logout_user'),
    
    # Ang ating mga API endpoints
    path('stats/', views.dashboard_stats, name='dashboard-stats'),
    path('ai-report/', views.ai_report_data, name='ai-report'),
    path('verify-face/', views.verify_face, name='verify-face'),
    path('compare-faces/', views.compare_faces, name='compare-faces'),
    path('budget-forecast/', views.budget_forecast, name='budget-forecast'),
    path('', include(router.urls)),
]
