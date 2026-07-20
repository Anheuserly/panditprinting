# Pandit Printing Press

Public website for **Pandit Printing Press**, operated by **S N Enterprises**.

## Catalogue data

The homepage reads published products from the AMC MEP Appwrite `marketplace_showcases` collection. Records are scoped to the configured S N Enterprises business ID and refreshed every 60 seconds.

Copy `.env.example` to `.env.local` only when overriding the checked-in public Appwrite identifiers. No Appwrite API key is required or exposed by this website.

## Development

```bash
npm install
npm run dev
```

Production validation:

```bash
npm run typecheck
npm run build
```

The Cloudflare Worker is named `panditprinting`. The checked-in Wrangler and
OpenNext configuration keeps the Worker self-reference on that same name.
