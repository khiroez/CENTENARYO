from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from django.http import FileResponse
import os

def serve_react(request, path=''):
    # If the path has an extension (like .js, .css, .png, .ico), serve it as a static file
    if '.' in path:
        return serve(request, path, document_root=os.path.join(settings.BASE_DIR.parent, 'frontend', 'out'))
    
    # Clean the path and look for the specific html file
    clean_path = path.strip('/')
    html_file = f"{clean_path}.html" if clean_path else "index.html"
    html_path = os.path.join(settings.BASE_DIR.parent, 'frontend', 'out', html_file)
    
    if os.path.exists(html_path):
        return FileResponse(open(html_path, 'rb'), content_type='text/html')
        
    # Fallback to index.html for client-side routing
    index_path = os.path.join(settings.BASE_DIR.parent, 'frontend', 'out', 'index.html')
    if os.path.exists(index_path):
        return FileResponse(open(index_path, 'rb'), content_type='text/html')
        
    # Return 404 if not found
    from django.http import Http404
    raise Http404("React build not found. Please run npm run build in the frontend.")

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.urls')),
    # Match _next files
    re_path(r'^_next/(?P<path>.*)$', serve, {'document_root': os.path.join(settings.BASE_DIR.parent, 'frontend', 'out', '_next')}),
]

# Serve media files (Requirements uploads)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Catch-all to serve Next.js static pages
urlpatterns += [
    re_path(r'^(?P<path>.*)$', serve_react),
]
