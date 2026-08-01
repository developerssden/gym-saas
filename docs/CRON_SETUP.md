# Cron Job Setup for Subscription Reminders

This document explains how to set up the subscription expiration reminder cron job.

## Overview

The cron job runs daily at 19:00 UTC, which is midnight in Pakistan (UTC+5), to:
- Check owner subscriptions and send reminders (2 days before, 1 day before, and on expiration)
- Check member subscriptions and send reminders (2 days before, 1 day before, and on expiration)
- Mark expired subscriptions and send notifications
- Send summary emails to Super Admins and Gym Owners

## Setup Instructions

### Option 1: Vercel Cron (Recommended for Vercel deployments)

1. **Configure `vercel.json`** (already configured):
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/check-subscriptions",
        "schedule": "0 19 * * *"
       }
     ]
   }
   ```

2. **Set `CRON_SECRET`** in your Vercel project environment variables. Vercel automatically sends this value as `Authorization: Bearer <CRON_SECRET>` when invoking scheduled cron jobs.

3. **Deploy to Vercel**: The cron job will automatically be set up when you deploy.

4. **Verify**: Check your Vercel dashboard → Settings → Cron Jobs to see the scheduled job.

### Option 2: External Cron Service

If you're not using Vercel, you can use external cron services like:
- **cron-job.org**
- **EasyCron**
- **Cronitor**

1. Create a cron job that calls: `https://your-domain.com/api/cron/check-subscriptions`
2. Set the schedule to: `0 19 * * *` (runs at 19:00 UTC / midnight UTC+5)
3. Set the HTTP method to: `GET`
4. Add one of these authorization headers:
   - `Authorization: Bearer YOUR_CRON_SECRET`
   - `x-cron-secret: YOUR_CRON_SECRET`

### Option 3: Manual Testing

You can manually trigger the cron job for testing:

```bash
curl -X GET https://your-domain.com/api/cron/check-subscriptions \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Or with the `x-cron-secret` header:

```bash
curl -X GET https://your-domain.com/api/cron/check-subscriptions \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

## Environment Variables

Make sure these environment variables are set:

- `GMAIL_USER`: Your Gmail address for sending emails
- `GMAIL_APP_PASSWORD`: Gmail App Password (not your regular password)
- `CRON_SECRET`: **Required.** Long random secret used to authenticate cron requests. Set the same value locally and in production.
- `APP_TIME_ZONE`: Optional IANA business timezone used for expiration-day calculations. Defaults to `Asia/Karachi`.

Example `.env`:

```
CRON_SECRET=your-long-random-secret-here
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
APP_TIME_ZONE=Asia/Karachi
```

## How It Works

### Owner Subscriptions

1. **2 Days Before Expiration**: Sends first reminder email to owner
2. **1 Day Before Expiration**: Sends second reminder email to owner
3. **On Expiration Day**: 
   - Marks subscription as expired
   - Sends expiration email to owner
   - Sends summary email to all Super Admins listing all expired owners

### Member Subscriptions

1. **2 Days Before Expiration**: Sends first reminder email to member
2. **1 Day Before Expiration**: Sends second reminder email to member
3. **On Expiration Day**:
   - Marks subscription as expired
   - Sends expiration email to member
   - Groups expired members by gym owner
   - Sends summary email to each gym owner listing their expired members

## Database Schema

The following fields track reminder status:

- `first_reminder_sent`: Boolean - Set to true after first reminder (2 days before)
- `second_reminder_sent`: Boolean - Set to true after second reminder (1 day before)
- `notification_sent`: Boolean - Set to true when subscription expires
- `is_expired`: Boolean - Set to true when subscription expires

## Email Templates

All emails are HTML formatted and include:
- Personalized greeting with user's name
- Clear expiration information
- Days remaining (for reminders)
- Professional styling

## Troubleshooting

### Cron job not running
- Check Vercel dashboard for cron job status
- Verify `vercel.json` is properly configured
- Verify `CRON_SECRET` is set in environment variables
- Check deployment logs for errors

### Cron job returns 401 Unauthorized
- Ensure `CRON_SECRET` is set in your environment
- Ensure the request includes `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`

### Emails not sending
- Verify `GMAIL_USER` and `GMAIL_APP_PASSWORD` are set correctly
- Check Gmail App Password is enabled in your Google account
- Review server logs for email sending errors

### Reminders sent multiple times
- The system checks `first_reminder_sent` and `second_reminder_sent` flags to prevent duplicates
- If issues persist, check database for correct flag values

## Testing

To test the cron job manually:

1. Create test subscriptions with expiration dates:
   - 2 days from today (for first reminder)
   - 1 day from today (for second reminder)
   - Today (for expiration)

2. Manually trigger the cron endpoint with the secret header

3. Verify:
   - Emails are sent correctly
   - Database flags are updated
   - Expired subscriptions are marked

## Schedule Format

The cron schedule `0 19 * * *` means:
- `0` - minute (0th minute)
- `19` - hour (19:00 UTC)
- `*` - day of month (every day)
- `*` - month (every month)
- `*` - day of week (every day of week)

This runs at 19:00 UTC daily, which is 12:00 AM the following calendar day in
Pakistan (UTC+5). Calendar-day comparisons use `APP_TIME_ZONE` rather than the
server's local timezone.

## Delivery guarantees

Reminder delivery is at-least-once. Delivery flags are written only after the
SMTP provider accepts an email, so a crash between delivery and the database
write can cause a duplicate on the next run. Failed expiration emails remain
eligible for retry; subscription expiration state is updated independently of
email delivery.
