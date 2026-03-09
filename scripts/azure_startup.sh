#!/usr/bin/env bash
# Azure App Service startup command.
# Set this as the startup command in the App Service configuration:
#   bash scripts/azure_startup.sh
#
# Or set it directly via Azure CLI:
#   az webapp config set --startup-file "bash scripts/azure_startup.sh" -n <app> -g <rg>

set -euo pipefail

cd /home/site/wwwroot/backend

pip install -r requirements.txt --quiet

exec gunicorn \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  app.main:app
