#!/usr/bin/env python3
"""
Simple script to start the Fitness Tracker application
"""
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

def check_dependencies():
    """Check if required Python packages are installed, if so then proceed"""
    try:
        import flask
        import flask_cors
        import flask_sqlalchemy
        import flask_jwt_extended
        import bcrypt
        print("✓ All Python dependencies are installed")
        return True
    except ImportError as e:
        print(f"✗ Missing dependency: {e}")
        print("Please run: pip install -r requirements.txt")
        return False

def start_backend():
    """Start the Flask backend server"""
    try:
        print("Starting Flask backend server...")
        backend_process = subprocess.Popen([
            sys.executable, "app.py"
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return backend_process
    except Exception as e:
        print(f"Failed to start backend: {e}")
        return None

def start_frontend():
    """Start the frontend server"""
    try:
        print("Starting frontend server...")
        frontend_process = subprocess.Popen([
            sys.executable, "-m", "http.server", "8080"
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return frontend_process
    except Exception as e:
        print(f"Failed to start frontend: {e}")
        return None

def main():
    print("🏋️  Fitness Tracker - Starting Application")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not Path("app.py").exists():
        print("❌ app.py not found. Please run this script from the project root directory.")
        sys.exit(1)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Start backend
    backend = start_backend()
    if not backend:
        print("❌ Failed to start backend server")
        sys.exit(1)
    
    # Wait a moment for backend to start
    print("Waiting for backend to initialize...")
    time.sleep(3)
    
    # Start frontend
    frontend = start_frontend()
    if not frontend:
        print("❌ Failed to start frontend server")
        backend.terminate()
        sys.exit(1)
    
    # Wait a moment for frontend to start
    time.sleep(2)
    
    print("\n🎉 Application started successfully!")
    print("=" * 50)
    print("📱 Frontend: http://localhost:8080")
    print("🔧 Backend API: http://localhost:5000")
    print("\nPress Ctrl+C to stop both servers")
    print("=" * 50)
    
    # Open browser
    try:
        webbrowser.open("http://localhost:8080")
    except:
        pass
    
    # Keep running until interrupted
    try:
        backend.wait()
    except KeyboardInterrupt:
        print("\n\n🛑 Shutting down servers...")
        backend.terminate()
        frontend.terminate()
        print("✅ Application stopped successfully")

if __name__ == "__main__":
    main()
