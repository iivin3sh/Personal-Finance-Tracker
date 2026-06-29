import os
import random
import pyotp
from datetime import UTC, datetime, timedelta

import jwt
from flask import jsonify
from werkzeug.security import check_password_hash, generate_password_hash

from db_models.user_model import load_users, save_users
from services.email_service import send_verification_email

SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-portfolio-key")

# Live temporary store for tracking sent verification codes
verification_codes = {}


def _normalize_email(email):
    return str(email or "").strip().lower()


def _verify_password(stored_password, plain_password):
    if not stored_password:
        return False
    if stored_password == plain_password:
        return True
    try:
        return check_password_hash(stored_password, plain_password)
    except ValueError:
        return False


def _build_token(email):
    payload = {
        "email": email,
        "exp": datetime.now(UTC) + timedelta(days=1),
        "iat": datetime.now(UTC),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return token.decode("utf-8") if isinstance(token, bytes) else token


def _verification_active(entry):
    if not entry:
        return False
    expires_at = entry.get("expires_at")
    if not expires_at:
        return False
    return datetime.now(UTC) <= datetime.fromisoformat(expires_at)


def register_user(data):
    email = _normalize_email(data.get("email"))
    password = str(data.get("password") or "")

    if not email or not password:
        return jsonify({"status": "error", "message": "Email and password required"}), 400

    users = load_users()
    if email in users:
        return jsonify({"status": "error", "message": "User already exists"}), 400

    # 🔑 GENERATE A UNIQUE SECRET KEY FOR THIS SPECIFIC USER
    user_totp_secret = pyotp.random_base32()

    users[email] = {
        "password": generate_password_hash(password),
        "totp_secret": user_totp_secret,  # 💾 Save it securely in their profile!
        "created_at": datetime.now(UTC).isoformat(),
    }
    save_users(users)
    
    # Create a provisioning URI link that authenticator apps can read
    # This labels the token inside their phone app as "FinanceTracker (their_email)"
    provisioning_url = pyotp.totp.TOTP(user_totp_secret).provisioning_uri(
        name=email, 
        issuer_name="FinanceTracker"
    )

    token = _build_token(email)
    return jsonify({
        "status": "success",
        "token": token,
        "email": email,
        # 🌟 Send this URI to the frontend so it can draw a QR Code!
        "totp_uri": provisioning_url 
    }), 201


def login_user(data):
    email = _normalize_email(data.get("email"))
    password = str(data.get("password") or "")

    users = load_users()
    user = users.get(email)
    if not user or not _verify_password(user.get("password"), password):
        return jsonify({"status": "error", "message": "Invalid email or password"}), 401

    token = _build_token(email)
    return jsonify({"status": "success", "token": token, "email": email})


def process_forgot_password(data):
    email = _normalize_email(data.get("email"))
    users = load_users()

    if email not in users:
        return jsonify({"status": "error", "message": "Account not found."}), 404

    # 🔍 Fetch this specific user's unique secret key from the file!
    user_secret = users[email].get("totp_secret")
    
    if not user_secret:
        return jsonify({"status": "error", "message": "Authenticator not configured for this account."}), 400

    return jsonify({
        "status": "success",
        "message": "Please enter the 6-digit verification code from your Authenticator App."
    })

def verify_reset_code(data):
    email = _normalize_email(data.get("email"))
    user_code = str(data.get("code") or "").strip()
    
    users = load_users()
    if email not in users:
        return jsonify({"status": "error", "message": "Account not found."}), 404

    user_secret = users[email].get("totp_secret")
    totp = pyotp.TOTP(user_secret)

    # 🌟 Math validation against their unique clock window!
    if totp.verify(user_code, valid_window=1):
        return jsonify({"status": "success", "message": "Identity validated successfully."})
        
    return jsonify({"status": "error", "message": "Invalid or expired authorization code."}), 400


def reset_user_password(data):
    email = _normalize_email(data.get("email"))
    user_code = str(data.get("code") or "").strip()
    new_password = str(data.get("new_password") or "")

    users = load_users()
    if email not in users:
        return jsonify({"status": "error", "message": "Account not found."}), 404

    user_secret = users[email].get("totp_secret")
    totp = pyotp.TOTP(user_secret)

    if not totp.verify(user_code, valid_window=1):
        return jsonify({"status": "error", "message": "Unauthorized request or expired code."}), 400
        
    if len(new_password) < 6:
        return jsonify({"status": "error", "message": "Password must be at least 6 characters"}), 400

    users[email]["password"] = generate_password_hash(new_password)
    users[email]["updated_at"] = datetime.now(UTC).isoformat()
    save_users(users)

    return jsonify({"status": "success", "message": "Password changed successfully."})
