@echo off
call backend\venv\Scripts\activate.bat
cd backend
python manage.py shell < create_su.py
python manage.py seed_data
