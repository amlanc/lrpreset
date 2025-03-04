#!/usr/bin/env python3
"""
Run script for the Pic2Preset application.
This script starts the Flask server which serves both the frontend and backend.
"""

import os
import subprocess
import sys

def main():
    """Run the Flask application"""
    print("Starting Pic2Preset server...")
    print("Access the application at: http://localhost:8000")
    print("Press Ctrl+C to stop the server")
    
    # Get the path to the app.py file
    app_path = os.path.join(os.path.dirname(__file__), 'backend', 'app.py')
    
    # Run the app.py file directly
    subprocess.run([sys.executable, app_path])

if __name__ == "__main__":
    main()
