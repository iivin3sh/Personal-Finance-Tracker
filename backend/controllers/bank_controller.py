from copy import deepcopy

from flask import jsonify

from services.transaction_service import (
    create_transaction_record,
    delete_transaction_by_id,
    delete_transaction_by_reverse_index,
    find_transaction_index,
    load_user_transactions,
    save_user_transactions,
    update_transaction_record,
    validate_transaction_payload,
)
from tracker import FinanceTracker


def _build_tracker(transactions):
    tracker = FinanceTracker()
    tracker.set_transactions(transactions)
    return tracker


def _summary_payload(transactions):
    tracker = _build_tracker(transactions)
    return {
        "balance": tracker.get_balance(),
        "history": tracker.get_history(),
        "insights": tracker.get_category_breakdown(),
        "income_total": tracker.get_income_total(),
        "expense_total": tracker.get_expense_total(),
        "transaction_count": tracker.get_transaction_count(),
    }


def _should_warn_overdraft(transactions, bypass_flag):
    tracker = _build_tracker(transactions)
    return tracker.get_balance() < 0 and not bypass_flag


def get_finance_summary(email):
    transactions = load_user_transactions(email)
    return jsonify({"status": "success", **_summary_payload(transactions)})


def get_transactions(email):
    transactions = load_user_transactions(email)
    return jsonify({"status": "success", "transactions": list(reversed(transactions)), **_summary_payload(transactions)})


def create_transaction(email, req_data):
    is_valid, message = validate_transaction_payload(req_data)
    if not is_valid:
        return jsonify({"status": "error", "message": message}), 400

    user_transactions = load_user_transactions(email)
    new_tx = create_transaction_record(req_data)
    simulated_transactions = [*user_transactions, new_tx]

    bypass = bool(req_data.get("bypass") or req_data.get("bypass_overdraft"))
    if new_tx["type"] == "expense" and _should_warn_overdraft(simulated_transactions, bypass):
        tracker = _build_tracker(simulated_transactions)
        return jsonify({
            "status": "overdraft_warning",
            "message": f"Warning: This expense will drop your balance to Rs. {tracker.get_balance()}!",
        }), 400

    user_transactions.append(new_tx)
    save_user_transactions(email, user_transactions)
    return jsonify({"status": "success", "transaction": new_tx, **_summary_payload(user_transactions)})


def update_transaction(email, transaction_id, req_data):
    is_valid, message = validate_transaction_payload(req_data)
    if not is_valid:
        return jsonify({"status": "error", "message": message}), 400

    user_transactions = load_user_transactions(email)
    index = find_transaction_index(user_transactions, transaction_id)
    if index == -1:
        return jsonify({"status": "error", "message": "Transaction not found."}), 404

    existing = user_transactions[index]
    updated_tx = update_transaction_record(existing, req_data)
    simulated_transactions = deepcopy(user_transactions)
    simulated_transactions[index] = updated_tx

    bypass = bool(req_data.get("bypass") or req_data.get("bypass_overdraft"))
    if updated_tx["type"] == "expense" and _should_warn_overdraft(simulated_transactions, bypass):
        tracker = _build_tracker(simulated_transactions)
        return jsonify({
            "status": "overdraft_warning",
            "message": f"Warning: This change will drop your balance to Rs. {tracker.get_balance()}!",
        }), 400

    user_transactions[index] = updated_tx
    save_user_transactions(email, user_transactions)
    return jsonify({"status": "success", "transaction": updated_tx, **_summary_payload(user_transactions)})


def delete_transaction(email, transaction_id=None, req_data=None):
    req_data = req_data or {}
    user_transactions = load_user_transactions(email)

    if transaction_id:
        deleted = delete_transaction_by_id(user_transactions, transaction_id)
    else:
        try:
            reversed_index = int(req_data.get("index"))
        except (TypeError, ValueError):
            return jsonify({"status": "error", "message": "Transaction id or index is required."}), 400
        deleted = delete_transaction_by_reverse_index(user_transactions, reversed_index)

    if not deleted:
        return jsonify({"status": "error", "message": "Transaction not found."}), 404

    save_user_transactions(email, user_transactions)
    return jsonify({"status": "success", "deleted": deleted, **_summary_payload(user_transactions)})


def handle_bank_operations(email, request_method, req_data):
    req_data = req_data or {}

    if request_method == "GET":
        return get_finance_summary(email)

    if request_method == "POST":
        action = str(req_data.get("action") or "add").lower()
        if action == "add":
            return create_transaction(email, req_data)
        if action == "update":
            transaction_id = req_data.get("id") or req_data.get("transaction_id")
            if not transaction_id:
                return jsonify({"status": "error", "message": "Transaction id is required for update."}), 400
            return update_transaction(email, transaction_id, req_data)
        return jsonify({"status": "error", "message": "Unsupported action."}), 400

    if request_method == "DELETE":
        transaction_id = req_data.get("id") or req_data.get("transaction_id")
        return delete_transaction(email, transaction_id=transaction_id, req_data=req_data)

    return jsonify({"status": "error", "message": "Method not allowed."}), 405
