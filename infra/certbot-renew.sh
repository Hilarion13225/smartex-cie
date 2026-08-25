#!/bin/sh
# Hook de renouvellement Let's Encrypt (VPS de démo uniquement, voir docker-compose.prod.yml).
#
# certbot (paquet apt) installe son propre timer systemd qui renouvelle automatiquement
# tout certificat approchant l'expiration -- ce script n'a PAS besoin d'être planifié
# lui-même. Il doit juste être copié une fois dans
# /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh (exécutable) : certbot exécute
# automatiquement tout script de ce dossier après un renouvellement réussi.
#
# Nécessaire car nginx (dans le conteneur frontend) lit les certificats une seule fois au
# démarrage -- sans ce reload, un renouvellement de certificat resterait sans effet sur le
# process nginx déjà lancé jusqu'au prochain redéploiement manuel.
docker exec cie-smart-prepaid-poc-frontend-1 nginx -s reload
