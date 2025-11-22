# Verification System Setup

This document explains how to set up email and SMS verification for the Mzansi app.

## Features

- **Email Verification**: Users can verify their email address with a 6-digit code
- **SMS Verification**: Users can verify their phone number with a 6-digit code sent via SMS
- **Driver Verification**: Admin can verify drivers (or automated based on document upload)

## Environment Variables

Add these to your `backend/.env` file:

### Email Configuration (SMTP)

```env
# SMTP Configuration for Email Verification
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

**For Gmail:**
1. Enable 2-factor authentication
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password as `SMTP_PASS`

**For other email providers:**
- **Outlook/Hotmail**: `smtp-mail.outlook.com`, port 587
- **Yahoo**: `smtp.mail.yahoo.com`, port 587
- **Custom SMTP**: Use your provider's SMTP settings

### SMS Configuration (Twilio)

```env
# Twilio Configuration for SMS Verification
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

**Twilio Setup:**
1. Sign up at https://www.twilio.com
2. Get your Account SID and Auth Token from the dashboard
3. Get a phone number (free trial available)
4. Add credentials to `.env`

**Note**: In development mode, SMS codes are logged to console instead of being sent.

## API Endpoints

### Email Verification

- `POST /api/verification/send-email-code` - Send verification code to email
- `POST /api/verification/verify-email` - Verify email with code
  - Body: `{ "code": "123456" }`

### SMS Verification

- `POST /api/verification/send-sms-code` - Send verification code via SMS
- `POST /api/verification/verify-phone` - Verify phone with code
  - Body: `{ "code": "123456" }`

### Status

- `GET /api/verification/status` - Get verification status
  - Returns: `{ emailVerified: boolean, phoneVerified: boolean, driverVerified?: boolean }`

### Driver Verification (Admin Only)

- `PUT /api/verification/verify-driver/:driverId` - Verify a driver (admin only)

## Usage in Mobile App

1. Navigate to Profile → Account Verification
2. For Email:
   - Tap "Send Verification Code"
   - Enter the 6-digit code received via email
   - Tap "Verify Email"
3. For Phone:
   - Tap "Send SMS Code"
   - Enter the 6-digit code received via SMS
   - Tap "Verify Phone"

## Development Mode

In development (`NODE_ENV=development`):
- Email codes are logged to console
- SMS codes are logged to console
- Codes are included in API responses for testing

## Production Mode

In production:
- Email codes are sent via SMTP
- SMS codes are sent via Twilio
- Codes are NOT included in API responses

## Verification Status

Users can check their verification status:
- Email verified: `user.verification.emailVerified`
- Phone verified: `user.verification.phoneVerified`
- Driver verified: `user.driverInfo.isVerified` (for drivers)

## Security Notes

- Verification codes expire after 10 minutes
- Codes are 6-digit random numbers
- Codes are hashed/stored securely in database
- Failed attempts should be rate-limited (future enhancement)

