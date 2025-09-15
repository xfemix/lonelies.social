## LONELIES — lonelies.social

Truth over comfort. Community platform for honest feedback and growth.

### Stack
- Backend: Node.js (Express), Prisma
- Database: PostgreSQL
- Cache/Queue: Redis
- Frontend: Next.js (App Router)

### Quick start (local)
1) Copy env
```
cp .env.example .env
cp infra/.env.example infra/.env
```

2) Start Postgres + Redis (requires Docker)
```
cd infra && docker compose up -d
```

3) Install all workspaces
```
npm install
```

4) Backend: migrate + seed, then run both servers
```
cd backend && npx prisma generate && npx prisma migrate dev --name init && npm run seed
cd ..
npm run dev
```

Backend runs at `http://localhost:4000`, Frontend at `http://localhost:3000`.

### Design notes
- Grayscale UI with user-theming later
- Categories seeded from product spec
- Minimal routes: `/health`, `/categories`, `/posts`

### Scripts
- Backend: `npm run dev`, `npm run migrate`, `npm run seed`
- Frontend: `npm run dev`
# lonelies.social
the official repo for lonelies.social
