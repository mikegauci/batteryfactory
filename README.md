# Battery Factory

Rebuild of [batteryfactory.mt](https://batteryfactory.mt) on Next.js + Supabase + Vercel with an in-house CMS. See `CLAUDE.md` for the decisions and conventions.

```bash
pnpm install
cp .env.example .env.local   # fill in the keys
pnpm dev
```

`pnpm migrate` imports the WordPress export in `migration/exports/` (dry run; add `--apply` to write).
