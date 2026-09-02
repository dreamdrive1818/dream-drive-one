#!/usr/bin/env bash
# Smoke-test FE.W.02 / FE.W.03 API dependencies. Requires API on :4000 and seeded DB.
set -euo pipefail
API="${API_URL:-http://localhost:4000}"

fail() { echo "FAIL: $1"; exit 1; }
ok() { echo "OK: $1"; }

echo "=== API health ==="
curl -sf "$API/health" | grep -q '"status":"ok"' || fail "health"
ok "GET /health"

echo "=== Cities ==="
CITIES=$(curl -sf "$API/v1/public/cities") || fail "cities request"
echo "$CITIES" | grep -q '"slug"' || fail "cities empty or invalid"
CITY_ID=$(echo "$CITIES" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j[0]?.id||'')})")
[[ -n "$CITY_ID" ]] || fail "no city id"
ok "GET /v1/public/cities (cityId=$CITY_ID)"

FROM=$(node -e "const d=new Date();d.setDate(d.getDate()+3);console.log(d.toISOString())")
TO=$(node -e "const d=new Date();d.setDate(d.getDate()+5);console.log(d.toISOString())")

echo "=== Search ==="
SEARCH_URL="$API/v1/public/search?cityId=$CITY_ID&from=$FROM&to=$TO&rentalType=SELF_DRIVE"
SEARCH=$(curl -sf "$SEARCH_URL") || fail "search request"
SLUG=$(echo "$SEARCH" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j[0]?.slug||'')})")
COUNT=$(echo "$SEARCH" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(Array.isArray(j)?j.length:0)})")
ok "GET /v1/public/search ($COUNT cars)"
[[ -n "$SLUG" ]] || fail "search returned no cars — run npm run db:seed"

echo "=== Car detail ==="
CAR=$(curl -sf "$API/v1/public/cars/$SLUG") || fail "car by slug"
echo "$CAR" | grep -q '"name"' || fail "car payload invalid"
CAR_ID=$(echo "$CAR" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.id||'')})")
ok "GET /v1/public/cars/$SLUG"

echo "=== Availability ==="
AVAIL=$(curl -sf "$API/v1/public/cars/$CAR_ID/availability?from=$FROM&to=$TO") || fail "availability"
echo "$AVAIL" | grep -q '"available"' || fail "availability payload invalid"
ok "GET /v1/public/cars/:id/availability"

echo "=== Banners (FE.W.01) ==="
BANNERS=$(curl -sf "$API/v1/public/banners") || fail "banners"
ok "GET /v1/public/banners ($(echo "$BANNERS" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(Array.isArray(j)?j.length:0)})") items)"

echo ""
echo "All API smoke checks passed."
echo "Browser: http://localhost:3000/fleet?cityId=$CITY_ID&from=$FROM&to=$TO"
echo "Detail:  http://localhost:3000/cars/$SLUG?cityId=$CITY_ID&from=$FROM&to=$TO&rentalType=SELF_DRIVE"
