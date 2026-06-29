import os
import smtplib
from email.mime.text import MIMEText

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "your-email@gmail.com")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "")


def send_verification_email(target_email, code):
    """Logs into secure email servers to deliver a password reset passcode."""
    if not SENDER_EMAIL or SENDER_EMAIL == "your-email@gmail.com" or not SENDER_PASSWORD:
        print("SMTP Email Error: sender credentials are not configured.")
        return False

    try:
        subject = "🔑 Ledger Engine Verification Passcode"
        body = (
            "Hello,\n\n"
            "You requested a password reset. Your secure 6-digit verification code is:\n\n"
            f"{code}\n\n"
            "If you did not request this, please ignore this email."
        )

        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = SENDER_EMAIL
        msg["To"] = target_email

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, target_email, msg.as_string())
        return True
    except Exception as error:
        print("SMTP Email Error:", error)
        return False
