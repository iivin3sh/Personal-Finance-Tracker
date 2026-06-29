import json
import os
from json import JSONDecodeError

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data_store")
DATA_FILE = os.path.join(DATA_DIR, "data.json")


def load_all_transactions():
    os.makedirs(DATA_DIR, exist_ok=True)
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as file:
            return json.load(file)
    except (FileNotFoundError, JSONDecodeError):
        return {}


def save_all_transactions(data):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4)
