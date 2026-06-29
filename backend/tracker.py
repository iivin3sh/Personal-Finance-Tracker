class FinanceTracker:
    def __init__(self):
        # Starts with an empty tray. The controller will fill this up on the fly!
        self.transactions = []

    def set_transactions(self, transactions):
        self.transactions = transactions or []

    def get_balance(self):
        """Pure math formula: sums up current balance."""
        total_balance = 0
        for t in self.transactions:
            if t["type"] == "income":
                total_balance += t["amount"]
            if t["type"] == "expense":
                total_balance -= t["amount"]
        return round(total_balance, 2)

    def get_history(self):
        """Returns the loaded list."""
        return self.transactions

    def predict_balance(self, test_amount):
        """Checks what the balance would look like if an expense was added."""
        return round(self.get_balance() - float(test_amount), 2)

    def get_income_total(self):
        return round(sum(t["amount"] for t in self.transactions if t["type"] == "income"), 2)

    def get_expense_total(self):
        return round(sum(t["amount"] for t in self.transactions if t["type"] == "expense"), 2)

    def get_transaction_count(self):
        return len(self.transactions)

    def get_category_breakdown(self):
        """Groups loaded transactions by category and sums them up."""
        breakdown = {}
        for t in self.transactions:
            if t["type"] == "expense":
                cat = t.get("category", "general").lower()
                amount = t["amount"]
                breakdown[cat] = breakdown.get(cat, 0) + amount

        return sorted(breakdown.items(), key=lambda item: item[1], reverse=True)
