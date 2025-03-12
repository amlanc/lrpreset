import os
import stripe
from flask import jsonify, request
import credit_system

"""
Payment processing module for LR Preset application.

IMPORTANT: This module does NOT store any payment card information (PCI data).
All payment processing is handled by Stripe, which is PCI compliant.
We only store credit balances and transaction records, not payment methods.
"""

# Set your Stripe API key
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY', 'sk_test_placeholder')

def create_checkout_session(preset_id, user_id):
    """
    Create a checkout session for a preset purchase.
    
    This function maintains backward compatibility with the existing implementation
    but will be deprecated in favor of create_credit_checkout_session.
    """
    try:
        # For backward compatibility, continue to use the mock implementation
        # until the credit system is fully integrated
        return {
            'id': f'mock_session_{preset_id}',
            'url': f'http://localhost:8001/success?session_id=mock_session_{preset_id}&preset_id={preset_id}'
        }
    except Exception as e:
        return {'error': str(e)}

def verify_payment(session_id):
    """
    Verify that a payment was successful.
    
    This function maintains backward compatibility with the existing implementation
    but will be extended to handle credit purchases as well.
    """
    # For backward compatibility with existing code
    if session_id.startswith('mock_session_'):
        preset_id = session_id.replace('mock_session_', '')
        return True, preset_id
        
    # For real Stripe sessions
    try:
        if not stripe.api_key or stripe.api_key == 'sk_test_placeholder':
            return False, None
            
        # Retrieve the session
        session = stripe.checkout.Session.retrieve(session_id)
        
        # Check if payment was successful
        if session.payment_status == 'paid':
            # Check if this was a preset purchase or credit purchase
            if session.metadata.get('preset_id'):
                return True, session.metadata.get('preset_id')
            elif session.metadata.get('credit_purchase'):
                # Handle credit purchase verification
                user_id = session.metadata.get('user_id')
                credit_packs = int(session.metadata.get('credit_packs', 1))
                
                # Add the purchased credits to the user's account
                success = credit_system.add_purchased_credits(user_id, credit_packs)
                
                return success, None
        
        return False, None
    except Exception as e:
        print(f"Error verifying payment: {e}")
        return False, None

def create_credit_checkout_session(user_id, credit_packs=1, success_url=None, cancel_url=None):
    """
    Create a Stripe checkout session for purchasing credits.
    
    This function redirects users to Stripe's secure checkout page.
    No payment card information is stored in our database.
    
    Args:
        user_id: ID of the user making the purchase
        credit_packs: Number of credit packs to purchase (default: 1)
        success_url: URL to redirect to after successful payment
        cancel_url: URL to redirect to after cancelled payment
        
    Returns:
        Dictionary with session ID and URL
    """
    try:
        # If Stripe is not configured, use mock implementation
        if not stripe.api_key or stripe.api_key == 'sk_test_placeholder':
            # Return mock data
            mock_session_id = f'mock_credit_session_{user_id}_{credit_packs}'
            return {
                'id': mock_session_id,
                'url': f'{success_url or "http://localhost:8001/success"}?session_id={mock_session_id}&credit_packs={credit_packs}'
            }
        
        # Set default URLs if not provided
        if not success_url:
            success_url = f'{os.environ.get("FRONTEND_URL", "http://localhost:8001")}/success'
        if not cancel_url:
            cancel_url = f'{os.environ.get("FRONTEND_URL", "http://localhost:8001")}/cancel'
        
        # Ensure the success URL has the session ID parameter
        if '?' in success_url:
            success_url += '&session_id={CHECKOUT_SESSION_ID}'
        else:
            success_url += '?session_id={CHECKOUT_SESSION_ID}'
        
        # Calculate the total price
        unit_price = int(credit_system.PRICE_PER_PACK * 100)  # Convert to cents
        
        # Create a checkout session
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[
                {
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': f'{credit_system.CREDITS_PER_PACK} Preset Credits',
                            'description': f'Purchase {credit_system.CREDITS_PER_PACK} credits for creating AI-generated Lightroom presets',
                        },
                        'unit_amount': unit_price,
                    },
                    'quantity': credit_packs,
                },
            ],
            mode='payment',
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                'user_id': user_id,
                'credit_packs': str(credit_packs),
                'credit_purchase': 'true'
            }
        )
        
        return {
            'id': checkout_session.id,
            'url': checkout_session.url
        }
    except Exception as e:
        print(f"Error creating credit checkout session: {e}")
        return {'error': str(e)}

def handle_webhook(payload, sig_header):
    """
    Handle Stripe webhooks for payment events.
    """
    webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
    
    # If we don't have a webhook secret or Stripe API key, use mock implementation
    if not webhook_secret or not stripe.api_key or stripe.api_key == 'sk_test_placeholder':
        return jsonify({'status': 'success'}), 200
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        # Invalid payload
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        return jsonify({'error': 'Invalid signature'}), 400
    
    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        # Extract metadata
        if session.metadata.get('preset_id'):
            # This is a preset purchase
            preset_id = session.metadata.get('preset_id')
            # Update database to mark preset as purchased
            # This would connect to your database logic
        elif session.metadata.get('credit_purchase'):
            # This is a credit purchase
            user_id = session.metadata.get('user_id')
            credit_packs = int(session.metadata.get('credit_packs', 1))
            
            # Add the purchased credits to the user's account
            credit_system.add_purchased_credits(user_id, credit_packs)
    
    return jsonify({'status': 'success'}), 200

# Temporary mock implementation until Stripe is set up
# def create_checkout_session(preset_id, user_id):
#     """
#     Create a Stripe checkout session for a preset purchase.
#     
#     Args:
#         preset_id: ID of the preset being purchased
#         user_id: ID of the user making the purchase
#         
#     Returns:
#         Dictionary with session ID and URL
#     """
#     try:
#         # Create a checkout session
#         checkout_session = stripe.checkout.Session.create(
#             payment_method_types=['card'],
#             line_items=[
#                 {
#                     'price_data': {
#                         'currency': 'usd',
#                         'product_data': {
#                             'name': 'Lightroom Preset',
#                             'description': 'Custom AI-generated Lightroom preset',
#                         },
#                         'unit_amount': 499,  # $4.99 in cents
#                     },
#                     'quantity': 1,
#                 },
#             ],
#             mode='payment',
#             success_url=f'{os.environ.get("FRONTEND_URL", "http://localhost:8001")}/success?session_id={{CHECKOUT_SESSION_ID}}&preset_id={preset_id}',
#             cancel_url=f'{os.environ.get("FRONTEND_URL", "http://localhost:8001")}/cancel',
#             metadata={
#                 'preset_id': preset_id,
#                 'user_id': user_id
#             }
#         )
#         
#         return {
#             'id': checkout_session.id,
#             'url': checkout_session.url
#         }
#     except Exception as e:
#         return {'error': str(e)}
#
# def verify_payment(session_id):
#     """
#     Verify that a payment was successful.
#     
#     Args:
#         session_id: Stripe session ID to verify
#         
#     Returns:
#         Boolean indicating if payment was successful
#     """
#     try:
#         # Retrieve the session
#         session = stripe.checkout.Session.retrieve(session_id)
#         
#         # Check if payment was successful
#         if session.payment_status == 'paid':
#             return True, session.metadata.get('preset_id')
#         else:
#             return False, None
#     except Exception as e:
#         print(f"Error verifying payment: {e}")
#         return False, None
#
# def handle_webhook(payload, sig_header):
#     """
#     Handle Stripe webhooks for payment events.
#     
#     Args:
#         payload: Request body from Stripe
#         sig_header: Stripe signature header
#         
#     Returns:
#         Response to send back to Stripe
#     """
#     webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
#     
#     try:
#         event = stripe.Webhook.construct_event(
#             payload, sig_header, webhook_secret
#         )
#     except ValueError as e:
#         # Invalid payload
#         return jsonify({'error': 'Invalid payload'}), 400
#     except stripe.error.SignatureVerificationError as e:
#         # Invalid signature
#         return jsonify({'error': 'Invalid signature'}), 400
#     
#     # Handle the event
#     if event['type'] == 'checkout.session.completed':
#         session = event['data']['object']
#         
#         # Extract metadata
#         preset_id = session.get('metadata', {}).get('preset_id')
#         user_id = session.get('metadata', {}).get('user_id')
#         
#         # Update database to mark preset as purchased
#         # This would connect to your database logic
#         
#         return jsonify({'status': 'success'}), 200
#     
#     return jsonify({'status': 'unhandled event type'}), 200 