import json
import os
from json import JSONDecodeError

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data_store")
USERS_FILE = os.path.join(DATA_DIR, "users.json")


def load_users():
    os.makedirs(DATA_DIR, exist_ok=True)
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as file:
            return json.load(file)
    except (FileNotFoundError, JSONDecodeError):
        return {}


def save_users(users):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(USERS_FILE, "w", encoding="utf-8") as file:
        json.dump(users, file, indent=4)
