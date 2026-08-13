#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
version=$(tr -d '[:space:]' < "$script_dir/version")

if command -v dex >/dev/null 2>&1; then
  installed_version=$(dex version | sed -n 's/^Dex Version: v//p')
  if [ "$installed_version" != "$version" ]; then
    echo "dex v$version is required, found v$installed_version" >&2
    exit 1
  fi
  exec dex serve "$script_dir/config.yaml"
fi

if command -v nix >/dev/null 2>&1 && [ "${CI:-}" != "true" ]; then
  exec nix shell nixpkgs#dex-oidc --command "$script_dir/run.sh"
fi

container_runtime=
if command -v docker >/dev/null 2>&1; then
  container_runtime=docker
elif command -v podman >/dev/null 2>&1; then
  container_runtime=podman
fi

if [ -n "$container_runtime" ]; then
  container_name="nuxt-oidc-auth-dex-$$"
  container_process=

  cleanup() {
    trap - EXIT HUP INT TERM
    if [ -n "$container_process" ]; then
      kill "$container_process" 2>/dev/null || true
      wait "$container_process" 2>/dev/null || true
    fi
    "$container_runtime" rm --force "$container_name" >/dev/null 2>&1 || true
  }

  trap cleanup EXIT HUP INT TERM
  "$container_runtime" run --rm --name "$container_name" --network host \
    --volume "$script_dir/config.yaml:/etc/dex/config.yaml:ro" \
    "ghcr.io/dexidp/dex:v$version" dex serve /etc/dex/config.yaml &
  container_process=$!
  wait "$container_process"
fi

echo "dex v$version requires dex, nix, docker, or podman" >&2
exit 1
