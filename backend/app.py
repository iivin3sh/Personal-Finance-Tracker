import jwt
from flask import Flask, jsonify, request
from flask_cors import CORS

from controllers.auth_controller import (
    SECRET_KEY,
    login_user,
    process_forgot_password,
    register_user,
    reset_user_password,
    verify_reset_code,
)
from controllers.bank_controller import (
    create_transaction,
    delete_transaction,
    get_finance_summary,
    get_transactions,
    handle_bank_operations,
    update_transaction,
)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]}})


def get_user_from_token():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    try:
        token = auth_header.split(" ", 1)[1]
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return decoded["email"]
    except Exception:
        return None


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "success", "message": "Finance Tracker API is running."})


# ─── AUTHENTICATION ROUTES ───
@app.route("/register", methods=["POST"])
def route_register():
    return register_user(request.json or {})


@app.route("/login", methods=["POST"])
def route_login():
    return login_user(request.json or {})


@app.route("/forgot-password", methods=["POST"])
def route_forgot():
    return process_forgot_password(request.json or {})


@app.route("/verify-code", methods=["POST"])
def route_verify():
    return verify_reset_code(request.json or {})


@app.route("/reset-password", methods=["POST"])
def route_reset():
    return reset_user_password(request.json or {})


@app.route("/me", methods=["GET"])
def route_me():
    email = get_user_from_token()
    if not email:
        return jsonify({"status": "error", "message": "Invalid token"}), 401
    return jsonify({"status": "success", "email": email})


# ─── SECURE FINANCIAL DATA ROUTES ───
@app.route("/summary", methods=["GET"])
def route_summary():
    email = get_user_from_token()
    if not email:
        return jsonify({"status": "error", "message": "Invalid token"}), 401
    return get_finance_summary(email)


@app.route("/transactions", methods=["GET", "POST"])
def route_transactions():
    email = get_user_from_token()
    if not email:
        return jsonify({"status": "error", "message": "Invalid token"}), 401

    if request.method == "GET":
        return get_transactions(email)
    return create_transaction(email, request.json or {})


@app.route('/transactions/<transaction_id>', methods=['DELETE', 'PUT', 'OPTIONS'])
def route_transaction_detail(transaction_id):
    if request.method == "OPTIONS":
        return jsonify({"status": "success"}), 200

    email = get_user_from_token()
    if not email:
        return jsonify({"status": "error", "message": "Invalid token"}), 401

    if request.method == "PUT":
        # 🌟 Use get_json(silent=True) here too just to be safe!
        return update_transaction(email, transaction_id, request.get_json(silent=True) or {})
        
    # 👇 CHANGE THIS LINE: Use request.get_json(silent=True) instead of request.json
    return delete_transaction(email, transaction_id=transaction_id, req_data=request.get_json(silent=True) or {})


# Legacy compatibility route for your original frontend/backend shape.
@app.route("/user-data", methods=["GET", "POST", "DELETE"])
def route_user_data():
    email = get_user_from_token()
    if not email:
        return jsonify({"status": "error", "message": "Invalid token"}), 401

    return handle_bank_operations(email, request.method, request.json if request.is_json else {})


if __name__ == "__main__":
    app.run(port=5000, debug=True)
