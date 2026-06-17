#!/bin/bash
set -e

FTP_USER='housedataus1@housedata.us'
FTP_PASS='4iA}tQ]JB)m&pWVw'
FTP_HOST='67.227.251.76'
DEPLOY_URL='https://housedata.us/api/deploy'
DEPLOY_SECRET='812e54424449b8278ddd5411cf35699d5a0fe50e9573a788c483c7bf69058eb5'

echo "→ Building..."
NEXT_PUBLIC_BASE_URL=https://housedata.us npm run build

echo "→ Copying static assets..."
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

echo "→ Packaging standalone..."
tar -czf /tmp/housedata-standalone.tar.gz -C . .next/standalone

echo "→ Uploading to VPS (~$(du -sh /tmp/housedata-standalone.tar.gz | cut -f1))..."
curl --ssl-reqd --insecure -T /tmp/housedata-standalone.tar.gz \
  "ftp://${FTP_HOST}/housedata-standalone.tar.gz" \
  --user "${FTP_USER}:${FTP_PASS}"

echo "→ Triggering deploy (extract + restart)..."
curl -sf -X POST "${DEPLOY_URL}" \
  -H "Authorization: Bearer ${DEPLOY_SECRET}"

echo "✓ Done"
