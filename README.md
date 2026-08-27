# RBW Reports

Ver [`CLAUDE.md`](03%20RAINBOW®/APPS/RBW%20REPORTS/CLAUDE.md) y el brief técnico para contexto completo del proyecto.

## Desarrollo local

```bash
docker compose up -d          # levanta Postgres local
pnpm install
pnpm db:push                  # aplica el schema a la base local
ADMIN_EMAIL=vos@rainbow.com ADMIN_PASSWORD=cambiame pnpm db:seed
pnpm dev
```

Abrí [http://localhost:3000](http://localhost:3000) — redirige a `/login`.
