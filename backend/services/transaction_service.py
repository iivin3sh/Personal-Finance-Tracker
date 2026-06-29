from datetime import datetime
from uuid import uuid4

from db_models.finance_model import load_all_transactions, save_all_transactions
ALLOWED_TYPES = {"income", "expense"}
DEFAULT_CATEGORY = "general"


def load_user_transactions(email):
    all_data = load_all_transactions()
    return all_data.get(email, [])


def save_user_transactions(email, transactions):
    all_data = load_all_transactions()
    all_data[email] = transactions
    save_all_transactions(all_data)


def _now_iso():
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M")


def _clean_text(value, fallback=""):
    return str(value or fallback).strip()


def validate_transaction_payload(payload):
    if not isinstance(payload, dict):
        return False, "Invalid request payload."

    try:
        amount = float(payload.get("amount", 0))
    except (TypeError, ValueError):
        return False, "Amount must be a valid number."

    tx_type = _clean_text(payload.get("type")).lower()
    category = _clean_text(payload.get("category"), DEFAULT_CATEGORY).lower()

    if amount <= 0:
        return False, "Amount must be greater than zero."
    if tx_type not in ALLOWED_TYPES:
        return False, "Transaction type must be income or expense."
    if not category:
        return False, "Category is required."

    return True, "ok"


def create_transaction_record(payload):
    amount = float(payload["amount"])
    tx_type = _clean_text(payload.get("type")).lower()
    category = _clean_text(payload.get("category"), DEFAULT_CATEGORY).lower()
    note = _clean_text(payload.get("note"))
    timestamp = _clean_text(payload.get("timestamp"), _now_iso())

    return {
        "id": payload.get("id") or str(uuid4()),
        "amount": amount,
        "type": tx_type,
        "category": category,
        "note": note,
        "timestamp": timestamp,
        "created_at": payload.get("created_at") or _now_iso(),
        "updated_at": _now_iso(),
    }


def update_transaction_record(existing, payload):
    updated = create_transaction_record({
        **existing,
        **payload,
        "id": existing.get("id"),
        "created_at": existing.get("created_at"),
        "timestamp": payload.get("timestamp", existing.get("timestamp", _now_iso())),
    })
    return updated


def find_transaction_index(transactions, transaction_id):
    for index, transaction in enumerate(transactions):
        if transaction.get("id") == transaction_id:
            return index
    return -1


def delete_transaction_by_id(transactions, transaction_id):
    index = find_transaction_index(transactions, transaction_id)
    if index == -1:
        return None
    return transactions.pop(index)


def delete_transaction_by_reverse_index(transactions, reversed_index):
    real_index = len(transactions) - 1 - reversed_index
    if 0 <= real_index < len(transactions):
        return transactions.pop(real_index)
    return None
