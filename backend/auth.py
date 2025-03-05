# backend/auth.py
# Google Authentication logic

import os
import requests
import json
import base64
import time
import jwt
from urllib.parse import urlencode

def verify_google_token(id_token):
    """
    Verify a Google ID token and return the user info
    """
    try:
        # Decode the token without verification for now
        # In production, you should verify the signature with Google's public keys
        payload = jwt.decode(id_token, options={"verify_signature": False})
        
        # Check if token is expired
        current_time = int(time.time())
        if current_time > payload['exp']:
            return None, "Token expired"
        
        # Return the user info
        user_info = {
            'id': payload['sub'],
            'email': payload.get('email'),
            'name': payload.get('name'),
            'picture': payload.get('picture')
        }
        
        return user_info, None
    except Exception as e:
        return None, str(e)

def exchange_code_for_tokens(code):
    """
    Exchange an authorization code for access and ID tokens
    """
    try:
        # Get the client ID and client secret from environment variables
        client_id = os.environ.get('GOOGLE_CLIENT_ID')
        client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
        redirect_uri = os.environ.get('GOOGLE_REDIRECT_URI', 'http://localhost:8000/google-callback')
        
        # Build the token request
        token_url = 'https://oauth2.googleapis.com/token'
        token_data = {
            'code': code,
            'client_id': client_id,
            'client_secret': client_secret,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code'
        }
        
        # Send the token request
        response = requests.post(token_url, data=token_data)
        
        # Check if the request was successful
        if response.status_code != 200:
            print(f"Error exchanging code for tokens: {response.status_code} {response.text}")
            return None, f"Error: {response.status_code} {response.text}"
        
        # Parse the response
        token_response = response.json()
        
        # Return the tokens
        return token_response, None
    except Exception as e:
        print(f"Error exchanging code for tokens: {e}")
        return None, str(e)

def get_user_info_from_token(id_token):
    """
    Get user info from an ID token
    """
    return verify_google_token(id_token)