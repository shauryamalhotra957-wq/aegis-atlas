# Security policy

Aegis Atlas is an interactive atlas prototype.

- Do not commit API keys, private location data, or unredacted operational feeds.
- Treat coordinates, labels, imported files, and URLs as untrusted input.
- Keep map rendering and export paths bounded to avoid resource exhaustion.
- Mark seeded scenarios and inferred values clearly; do not present them as verified intelligence.
- Review new network integrations for authentication, origin checks, retention, and least privilege.

Report data exposure, injection, unsafe file handling, or authentication bypass privately to the repository owner.
