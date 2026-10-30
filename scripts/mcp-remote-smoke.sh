#!/usr/bin/env bash
# Post-deploy smoke check for the remote MCP (ADR-017, T-surfaces-sync):
# a read-only `tools/list` against https://texuli.com/mcp, compared with the
# tool names the committed server card says the remote serves. The card is
# generated from the operations registry and `pnpm check:surfaces` fails on
# drift, so this compares the live server with the registry.
#
# The Pages deploy of the same commit may still be rolling out, so the check
# retries (MCP_SMOKE_ATTEMPTS, default 20, every MCP_SMOKE_DELAY seconds,
# default 30) before it fails. Needs curl and jq; reads nothing else.
#
#   bash scripts/mcp-remote-smoke.sh
#   MCP_SMOKE_URL=http://127.0.0.1:8788/mcp MCP_SMOKE_ATTEMPTS=1 bash scripts/mcp-remote-smoke.sh
set -euo pipefail

url="${MCP_SMOKE_URL:-https://texuli.com/mcp}"
attempts="${MCP_SMOKE_ATTEMPTS:-20}"
delay="${MCP_SMOKE_DELAY:-30}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
card="${MCP_SMOKE_CARD:-$root/apps/website/public/.well-known/mcp/server-card.json}"

expected="$(jq -r '([.tools[] | select(.remote) | .name] + [.deprecatedTools[] | select(.remote) | .name]) | .[]' "$card")"
protocol="$(jq -r '.protocolVersion' "$card")"
version="$(jq -r '.serverInfo.version' "$card")"

for attempt in $(seq 1 "$attempts"); do
  body="$(curl -sS --max-time 20 -X POST "$url" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -H "MCP-Protocol-Version: $protocol" \
    --data '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' || true)"
  actual="$(printf '%s' "$body" | jq -r 'if .result.nextCursor then error("paged") else .result.tools[].name end' 2>/dev/null || true)"
  if [ -n "$actual" ] && [ "$actual" = "$expected" ]; then
    echo "mcp-remote-smoke ✓ $url lists the $(printf '%s\n' "$expected" | wc -l | tr -d ' ') registry tools (card version $version)"
    exit 0
  fi
  echo "attempt $attempt/$attempts: $url does not list the registry tools yet"
  if [ "$attempt" -lt "$attempts" ]; then sleep "$delay"; fi
done

echo "::error title=Remote MCP drift::$url tools/list differs from the registry (server card $card)"
diff <(printf '%s\n' "$expected") <(printf '%s\n' "${actual:-}") || true
exit 1
