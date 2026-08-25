"""
T14 - Latence end-to-end (docs/02_developer-pack-poc.md §14_TestMatrix).

Mesure le temps entre l'envoi d'un paiement simulé (POST /simulate-payment sur le
payment-simulator) et le moment où la recharge correspondante atteint
finalStatus=CREDIT_APPLIED en base (colonne recharge.status), avec un peu de
parallélisme (--concurrency).

⚠️ Ce n'est PAS un test de charge représentatif d'une charge de production réelle :
c'est une première mesure de latence de base, sur un environnement de labo local
(un seul device mock-dongle, un seul broker MQTT, tout sur la même machine que le
backend). Aucune conclusion de dimensionnement ne doit en être tirée sans un vrai
test de charge sur une infrastructure représentative.

Corrélation paiement -> recharge : le payment-simulator ne renvoie que
`transactionId` (pas de rechargeId ni de correlationId). Ce script interroge donc
directement la base Postgres (payment.provider_tx_id -> recharge.payment_id) pour
retrouver puis suivre la recharge correspondante -- pas d'appel à l'API REST
protégée du backend, volontairement, pour ne pas mélanger la latence mesurée avec
celle de l'authentification/JWT (hors périmètre de T14).

Prérequis : `docker compose up` (au moins backend, mock-dongle, mosquitto,
payment-simulator, postgres), port 5432 exposé sur l'hôte (voir docker-compose.yml).

Usage :
    pip install -r infra/perf/requirements.txt
    python infra/perf/t14_latency.py --count 60 --concurrency 8
"""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import asyncpg
import httpx

TERMINAL_SUCCESS = {"CREDIT_APPLIED"}
TERMINAL_FAILURE = {"COMMAND_REJECTED", "FALLBACK_TOKEN_SENT"}


@dataclass
class Outcome:
    index: int
    transaction_id: str | None = None
    success: bool = False
    latency_ms: float | None = None
    final_status: str | None = None
    error: str | None = None


async def run_one(index: int, client: httpx.AsyncClient, pool: asyncpg.Pool, args: argparse.Namespace,
                   sem: asyncio.Semaphore) -> Outcome:
    outcome = Outcome(index=index)
    async with sem:
        customer_id = f"PERF-{index}-{uuid.uuid4().hex[:8]}"
        t0 = time.monotonic()
        try:
            resp = await client.post(
                f"{args.simulator_url}/simulate-payment",
                json={"meterId": args.meter_id, "customerId": customer_id, "amountXof": args.amount},
                timeout=10.0,
            )
            resp.raise_for_status()
            transaction_id = resp.json()["transactionId"]
        except Exception as exc:  # noqa: BLE001 - on veut capturer/rapporter, pas planter le run
            outcome.error = f"simulate-payment: {exc}"
            return outcome
        outcome.transaction_id = transaction_id

        deadline = time.monotonic() + args.timeout_seconds
        row = None
        while time.monotonic() < deadline:
            row = await pool.fetchrow(
                """
                SELECT r.status
                FROM payment p
                JOIN recharge r ON r.payment_id = p.payment_id
                WHERE p.provider_tx_id = $1
                """,
                transaction_id,
            )
            if row is not None:
                status = row["status"]
                if status in TERMINAL_SUCCESS:
                    outcome.success = True
                    outcome.final_status = status
                    outcome.latency_ms = (time.monotonic() - t0) * 1000
                    return outcome
                if status in TERMINAL_FAILURE:
                    outcome.final_status = status
                    outcome.error = f"statut terminal non-succès: {status}"
                    return outcome
            await asyncio.sleep(args.poll_interval)

        outcome.error = f"timeout après {args.timeout_seconds}s (dernier statut vu: pas de recharge trouvée)" \
            if row is None else f"timeout après {args.timeout_seconds}s (bloqué à {row['status']})"
        return outcome


def percentile(values: list[float], p: float) -> float:
    """Percentile par interpolation linéaire (méthode "nearest-rank" simplifiée,
    suffisante pour un rapport de latence de base -- pas besoin de la précision
    d'une lib stats dédiée pour ce volume)."""
    if not values:
        return float("nan")
    s = sorted(values)
    k = (len(s) - 1) * (p / 100)
    f, c = int(k), min(int(k) + 1, len(s) - 1)
    if f == c:
        return s[f]
    return s[f] + (s[c] - s[f]) * (k - f)


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--count", type=int, default=60, help="Nombre de recharges à déclencher (défaut 60)")
    parser.add_argument("--concurrency", type=int, default=8, help="Parallélisme (défaut 8)")
    parser.add_argument("--amount", type=float, default=1000, help="Montant XOF par recharge (défaut 1000)")
    parser.add_argument("--meter-id", default="CIE-LAB-0001", help="Meter de labo pré-enregistré")
    parser.add_argument("--simulator-url", default="http://localhost:9000",
                         help="http://payment-simulator:9000 si exécuté à l'intérieur du réseau docker compose")
    parser.add_argument("--timeout-seconds", type=float, default=15.0, help="Timeout par recharge")
    parser.add_argument("--poll-interval", type=float, default=0.15, help="Intervalle de poll DB en secondes")
    parser.add_argument("--db-host", default="localhost",
                         help="'postgres' si exécuté à l'intérieur du réseau docker compose -- voir README.md : "
                              "le port hôte 5432 peut être en conflit avec un PostgreSQL natif déjà installé "
                              "localement, auquel cas la connexion directe depuis l'hôte échoue de façon "
                              "intermittente/trompeuse (authentification KO ou connexion réinitialisée selon "
                              "lequel des deux serveurs répond)")
    parser.add_argument("--db-port", type=int, default=5432)
    parser.add_argument("--db-name", default="cie_smart_prepaid_poc")
    parser.add_argument("--db-user", default="poc_user")
    parser.add_argument("--db-password", default="poc_password")
    parser.add_argument("--out-dir", default=str(Path(__file__).parent / "results"))
    args = parser.parse_args()

    pool = await asyncpg.create_pool(
        host=args.db_host, port=args.db_port, database=args.db_name,
        user=args.db_user, password=args.db_password,
        min_size=2, max_size=args.concurrency + 2,
    )
    sem = asyncio.Semaphore(args.concurrency)

    print(f"T14 - {args.count} recharges, concurrence={args.concurrency}, "
          f"meter={args.meter_id}, montant={args.amount} XOF")
    print("(mesure de latence de base sur un poste de labo -- pas un test de charge de production)")
    print()

    t_run_start = time.monotonic()
    async with httpx.AsyncClient() as client:
        outcomes = await asyncio.gather(*[
            run_one(i, client, pool, args, sem) for i in range(args.count)
        ])
    t_run_total = time.monotonic() - t_run_start
    await pool.close()

    successes = [o for o in outcomes if o.success]
    failures = [o for o in outcomes if not o.success]
    latencies = [o.latency_ms for o in successes]

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "count": args.count,
        "concurrency": args.concurrency,
        "amount_xof": args.amount,
        "meter_id": args.meter_id,
        "success_count": len(successes),
        "failure_count": len(failures),
        "success_rate_pct": round(100 * len(successes) / args.count, 2) if args.count else 0,
        "wall_clock_seconds": round(t_run_total, 2),
        "latency_ms": {
            "min": round(min(latencies), 1) if latencies else None,
            "p50": round(percentile(latencies, 50), 1) if latencies else None,
            "p95": round(percentile(latencies, 95), 1) if latencies else None,
            "p99": round(percentile(latencies, 99), 1) if latencies else None,
            "max": round(max(latencies), 1) if latencies else None,
            "mean": round(statistics.fmean(latencies), 1) if latencies else None,
        },
        "failures": [{"index": o.index, "transactionId": o.transaction_id, "error": o.error} for o in failures],
    }

    print(f"Terminé en {t_run_total:.1f}s (mur) pour {args.count} recharges.")
    print(f"Succès : {report['success_count']}/{args.count} ({report['success_rate_pct']}%)")
    if latencies:
        lm = report["latency_ms"]
        print(f"Latence (ms) : min={lm['min']}  p50={lm['p50']}  p95={lm['p95']}  "
              f"p99={lm['p99']}  max={lm['max']}  moyenne={lm['mean']}")
    if failures:
        print(f"\n{len(failures)} échec(s)/timeout(s) :")
        for f in failures:
            print(f"  - #{f.index} (transactionId={f.transaction_id}): {f.error}")

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"t14-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    out_file.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nRapport écrit dans {out_file}")


if __name__ == "__main__":
    # asyncpg est incompatible avec le ProactorEventLoop, boucle par défaut sur
    # Windows depuis Python 3.8 (échoue avec ConnectionResetError/
    # ConnectionDoesNotExistError sur le handshake initial) -- SelectorEventLoop
    # requis. Sans effet sur Linux/macOS (déjà la boucle par défaut).
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
