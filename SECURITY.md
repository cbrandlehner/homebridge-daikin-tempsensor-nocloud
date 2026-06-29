# Security Policy

## Reporting a Vulnerability

Thank you for helping improve the security of this project!

If you discover a security vulnerability, please report it privately. **Do not open a public GitHub issue** for security problems.

- **Preferred method**: Open a [private vulnerability report on GitHub](https://github.com/cbrandlehner/homebridge-daikin-tempsensor-nocloud/security/advisories/new) (requires a GitHub account).
- **Alternative**: Email the maintainer directly at chris@brandlehner.at (or replace with your preferred secure contact if different).

Please include as much detail as possible:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

I will acknowledge receipt within 48 hours and work to validate, fix, and release an update as quickly as possible. If the report is valid, you'll be credited in the release notes (unless you prefer anonymity).

## Supported Versions

Security updates (bug fixes affecting security) are provided for the latest released version only. Older versions may not receive backported fixes.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| Older   | :x:                |

## Security Considerations for Users

This plugin communicates directly with your Daikin Wi-Fi controller over the local network:

- **Keep your home network secure** — Use strong Wi-Fi passwords, network segmentation, and firewall rules to prevent unauthorized access.
- **HTTPS support**: When using HTTPS, register a client token (UUID) properly using the device's 13-digit key. Avoid skipping certificate verification in production.
- **No cloud dependency**: All communication is local, reducing external attack surface — but ensure the device itself is not exposed to the internet.
- Run Homebridge with least-privilege (non-root user) where possible.

Dependencies are kept minimal and updated regularly via Dependabot.

## Disclosures

There are currently no known security vulnerabilities. Any past advisories will be listed here.

Thank you for responsibly disclosing issues!
