# Todo – microservice med Docker (Mac → Docker Hub → AWS EC2)

```
Internet → lb (nginx :80) ─┬─ /      → frontend (nginx)
                           └─ /api/  → api ×3 ── backend_net ── db (PostgreSQL + volume pgdata)
```
Nätverk: `frontend_net` (lb, frontend, api) och `backend_net` (api, db). Frontend och lb kan alltså inte nå databasen.

## Viktigt för Mac (Apple Silicon)
Mac M1–M4 bygger arm64-images, vanliga EC2-instanser (t2/t3) är amd64. Använd därför `./build-push.sh`, som kör vanliga `docker build --platform ...` och `docker push`.
- amd64-instans (t3.micro, rekommenderas, fungerar också med CI/CD): `./build-push.sh`
- Graviton-instans (t4g.micro, välj Ubuntu **ARM64**-AMI): `PLATFORM=linux/arm64 ./build-push.sh`
Blanda inte: fel plattform ger `exec format error` på EC2. GitHub Actions bygger amd64.

## 1. Lokalt på Macen
```bash
cp .env.example .env                 # fyll i DOCKERHUB_USER och DB_PASSWORD
cd api && npm test && cd ..          # kräver Node 20+
docker compose -f docker-compose.yml -f docker-compose.dev.yml build   # lokal test (arm64 går bra)
docker compose up -d --scale api=3   # http://localhost
docker compose down
```
Tips: kör `cd api && npm install` en gång och committa `package-lock.json`; byt sedan `npm install` mot `npm ci` i api/Dockerfile.

## 2. Docker Hub
```bash
docker login
./build-push.sh                      # docker build + docker push för alla tre, amd64
```
Eller manuellt, en image i taget (bra att visa i screencasten):
```bash
docker build --platform linux/amd64 -t DITTNAMN/todo-api:latest ./api
docker push DITTNAMN/todo-api:latest
# samma för ./frontend (todo-frontend) och ./lb (todo-lb)
```

## 3. AWS EC2
1. Starta Ubuntu 22.04/24.04, t3.micro. Skapa nyckelpar (.pem). Security group: port 80 (alla), port 22.
2. Tilldela en Elastic IP.
3. Från Macen: `./copy-to-ec2.sh ~/Downloads/min-nyckel.pem ELASTIC-IP`
4. Logga in och installera Docker:
```bash
ssh -i ~/Downloads/min-nyckel.pem ubuntu@ELASTIC-IP
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker ubuntu && newgrp docker
cd ~/todo && docker compose pull && docker compose up -d --scale api=3 && docker compose ps
```
Öppna `http://ELASTIC-IP`.

## 4. Backup (cron) och återställning
```bash
crontab -e
0 3 * * * /home/ubuntu/todo/backup.sh >> /home/ubuntu/todo/backup.log 2>&1
```
Demo:
```bash
./backup.sh
docker compose down -v               # raderar volymen!
docker compose up -d --scale api=3   # vänta tills db är healthy
./restore.sh backups/<fil>.sql.gz
```

## 5. CI/CD (GitHub Actions)
Repo-secrets: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `EC2_HOST` (Elastic IP), `EC2_SSH_KEY` (privat deploy-nyckel, skapad med `ssh-keygen -t ed25519`; den publika läggs i `~/.ssh/authorized_keys` på EC2).
`git push` till `main` → tester → bygg & push (amd64) → SSH → `compose pull` + `up -d`.

## Windows App / radslut
Redigerar du filer via Windows får skripten ibland CRLF → `bad interpreter` på Linux. `.gitattributes` tvingar LF i git, och `copy-to-ec2.sh` rensar CR på servern. Använd gärna VS Code (LF längst ned till höger).

## Demo-kommandon för screencasten
| Visa | Kommando |
|---|---|
| Image på Docker Hub | Repo-sidan i webbläsaren |
| Körs via compose | `docker compose ps` (visar healthy) |
| Named volume | `docker volume ls` / `docker volume inspect todo_pgdata` |
| Nätverksisolering | `docker compose exec frontend ping -c1 db` (misslyckas), `docker compose exec api ping -c1 db` (fungerar) |
| Skalning + lb | `curl -s localhost/api/whoami` flera gånger, hostname växlar |
| Icke-root | `docker compose exec api whoami` → `node`, `db` → `postgres`, `lb` → `nginx` |
| Healthcheck | `docker compose stop db`, vänta ~30 s, `docker compose ps`, sedan `start db` |
| Persistens | `docker compose down && docker compose up -d`, todos finns kvar |
