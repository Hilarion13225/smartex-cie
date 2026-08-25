# T14 — Latence end-to-end

Outil de mesure de latence pour `docs/02_developer-pack-poc.md` §14_TestMatrix (T14).
Voir `t14_latency.py` pour la méthode exacte et les limites (ce n'est **pas** un test
de charge représentatif d'une charge de production réelle).

## Usage

```bash
docker compose up -d          # backend, mock-dongle, mosquitto, payment-simulator, postgres
pip install -r infra/perf/requirements.txt
python infra/perf/t14_latency.py --count 60 --concurrency 8
```

Options utiles : `--count`, `--concurrency`, `--amount`, `--meter-id`,
`--timeout-seconds`. Voir `python infra/perf/t14_latency.py --help` pour la liste
complète (connexion DB, URL du payment-simulator, etc. — tous ont un défaut cohérent
avec `docker-compose.yml`).

Chaque exécution écrit un rapport JSON horodaté dans `infra/perf/results/`
(non commité — voir `.gitignore`) pour comparaison entre exécutions.
