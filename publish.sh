#!/usr/bin/env bash
# publish.sh — Build and tag a production Docker image for smart-access-ui.
#
# Usage:
#   ./publish.sh --tag <image:tag> [--base-path <path>] [--push]
#
# Options:
#   --tag        <image:tag>   Required. Docker image name and tag.
#                              e.g. myregistry.io/smart-access-ui:1.2.3
#   --base-path  <path>        Optional. Angular base-href (default: /).
#                              Must start and end with a slash.
#                              e.g. /smart-access/
#   --push                     Optional. Push the image to the registry after build.
#
# Examples:
#   ./publish.sh --tag smart-access-ui:latest
#   ./publish.sh --tag myregistry.io/smart-access-ui:1.0.0 --base-path /portal/ --push

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
TAG=""
BASE_PATH="/"
PUSH=false

# ── Parse arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG="$2"
      shift 2
      ;;
    --base-path)
      BASE_PATH="$2"
      shift 2
      ;;
    --push)
      PUSH=true
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# ── Validate ──────────────────────────────────────────────────────────────────
if [[ -z "$TAG" ]]; then
  echo "Error: --tag is required." >&2
  echo "Usage: ./publish.sh --tag <image:tag> [--base-path <path>] [--push]" >&2
  exit 1
fi

if [[ ! "$BASE_PATH" =~ ^/ ]]; then
  echo "Error: --base-path must start with a slash (e.g. / or /smart-access/)." >&2
  exit 1
fi

if [[ ! "$BASE_PATH" =~ /$ ]]; then
  echo "Error: --base-path must end with a slash (e.g. / or /smart-access/)." >&2
  exit 1
fi

# ── Build ─────────────────────────────────────────────────────────────────────
echo "▶  Building image: ${TAG}"
echo "   base-href: ${BASE_PATH}"

docker build \
  --build-arg BASE_HREF="${BASE_PATH}" \
  --tag "${TAG}" \
  --file "$(dirname "$0")/Dockerfile" \
  "$(dirname "$0")"

echo "✔  Image built: ${TAG}"

# ── Push (optional) ───────────────────────────────────────────────────────────
if [[ "$PUSH" == true ]]; then
  echo "▶  Pushing image: ${TAG}"
  docker push "${TAG}"
  echo "✔  Image pushed: ${TAG}"
fi
