import os
import sys
import threading
import time
import socket
import webbrowser
from django.core.management import execute_from_command_line

# Explicit imports to guide PyInstaller's static analysis for Django settings
import dotenv
import dj_database_url
import rest_framework
import rest_framework_simplejwt
import corsheaders
import whitenoise
import PIL

# Force console output to use UTF-8 on Windows to prevent UnicodeEncodeError
try:
    sys.stdout.reconfigure(encoding='utf-8')
except:
    pass

def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def run_django(base_dir):
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    
    # In PyInstaller, sys.path needs to point to the correct internal backend folder
    backend_dir = os.path.join(base_dir, 'backend')
    sys.path.append(backend_dir)
    
    sys.argv = ['manage.py', 'runserver', '127.0.0.1:8000', '--noreload']
    execute_from_command_line(sys.argv)

def main():
    # Determine base directory (handles PyInstaller temp extraction path)
    if hasattr(sys, '_MEIPASS'):
        base_dir = sys._MEIPASS
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))

    # Change directory to backend so sqlite database is found/created in the correct place
    backend_dir = os.path.join(base_dir, 'backend')
    os.chdir(backend_dir)

    print("=========================================================")
    print("                CENTENARYO REGISTRY SYSTEM               ")
    print("=========================================================")
    print("   Inihahanda ang local database at web services...")
    print("=========================================================")

    # Start Django in a background thread
    django_thread = threading.Thread(target=run_django, args=(base_dir,), daemon=True)
    django_thread.start()
    
    # Wait for Django to start
    for _ in range(30):
        if is_port_open(8000):
            break
        time.sleep(0.5)

    print("\n   [OK] HANDANG-HANDA NA ANG SYSTEM!")
    print("   [URL] Tumatakbo sa: http://127.0.0.1:8000/")
    print("\n   [INFO] MGA PAALALA SA PAGGAMIT:")
    print("   1. HUWAG ISARA ang window na ito habang ginagamit ang system.")
    print("   2. Upang ISARA at I-STOP ang system, i-click lamang ang 'X' ng window na ito.")
    print("=========================================================\n")

    # Open browser in App Mode (standalone native window)
    url = "http://127.0.0.1:8000/login/"
    opened = False
    
    # Try Chrome App Mode
    try:
        os.system(f'start chrome --app={url}')
        opened = True
    except:
        pass
        
    # Try Edge App Mode
    if not opened:
        try:
            os.system(f'start msedge --app={url}')
            opened = True
        except:
            pass
            
    # Fallback to default browser
    if not opened:
        webbrowser.open(url)
        
    # Keep main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nPinapatay ang CENTENARYO Server...")

if __name__ == '__main__':
    main()
