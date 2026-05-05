from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

# Ginagamit ang DefaultRouter ng DRF para mabilis ma-generate ang lahat ng CRUD endpoints
router = DefaultRouter()
router.register(r'seniors', views.SeniorViewSet, basename='senior')
router.register(r'disbursements', views.DisbursementViewSet, basename='disbursement')
router.register(r'anomalies', views.AnomalyFlagViewSet)
router.register(r'auditlogs', views.AuditLogViewSet)

urlpatterns = [
    # JWT Authentication Endpoints
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Current User Endpoint (returns role for RBAC)
    path('me/', views.get_current_user, name='current_user'),
    
    # Ang ating mga API endpoints
    path('stats/', views.dashboard_stats, name='dashboard-stats'),
    path('ai-report/', views.ai_report_data, name='ai-report'),
    path('', include(router.urls)),
]
