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
  exec "$container_runtime" run --rm --network host \
    --volume "$script_dir/config.yaml:/etc/dex/config.yaml:ro" \
    "ghcr.io/dexidp/dex:v$version" dex serve /etc/dex/config.yaml
fi

echo "dex v$version requires dex, nix, docker, or podman" >&2
exit 1
