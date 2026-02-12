# Security Guide

## API Key Safety

- **Never commit API keys** to version control
- Store keys only in `.env` files (which are in `.gitignore`)
- Set file permissions: `chmod 600 .env`
- Use Kraken's **IP whitelist** feature - only allow your VPS IP
- Create keys with **minimum required permissions** (no withdraw/deposit)
- Rotate keys periodically

## VPS Security

- Use SSH key authentication, disable password login
- Configure UFW firewall: only allow SSH (port 22)
- Keep system updated: `apt update && apt upgrade`
- Use a non-root user for the bot (optional but recommended)
- Monitor SSH access logs

## Database Security

- Use Supabase's Row Level Security if exposing to public
- The `service_role` key should only be in server-side env vars (not `NEXT_PUBLIC_`)
- Regularly review Supabase access logs
- The dashboard uses the service role key server-side only

## Dashboard Security

- Always set `DASHBOARD_PASSWORD` in production
- Use HTTPS (Vercel provides this automatically)
- The dashboard is **read-only** - it cannot execute trades
- Auth cookie is HTTP-only and secure in production

## Operational Security

- Monitor Telegram alerts for unexpected behavior
- Review trade logs daily
- Set up VPS monitoring (uptime checks)
- Keep backups of your `.env` file in a secure location (not cloud)
- Document your API key permissions and review periodically

## Incident Response

1. Stop the bot: `sudo systemctl stop autotrader`
2. Delete/disable API key on Kraken
3. Review trade history for unauthorized activity
4. Rotate all credentials
5. Review VPS access logs
6. Contact exchange support if needed
