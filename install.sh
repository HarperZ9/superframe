#!/usr/bin/env sh
# Zero-friction 1-command installer for Superframe (The Playground) with fail-closed SHA256SUMS verification.
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/HarperZ9/superframe/main/install.sh | sh
#   sh install.sh --self-test
set -eu

REPO="HarperZ9/superframe"
VERSION="${SUPERFRAME_VERSION:-latest}"
INSTALL_DIR="${SUPERFRAME_INSTALL_DIR:-$HOME/.superframe}"
FROM_DIR="${SUPERFRAME_FROM_DIR:-}"
WITH_RAW_DX12=0
NO_PATH=0
SELF_TEST=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --install-dir) INSTALL_DIR="$2"; shift 2 ;;
    --from-dir) FROM_DIR="$2"; shift 2 ;;
    --with-raw-dx12) WITH_RAW_DX12=1; shift ;;
    --no-path) NO_PATH=1; shift ;;
    --self-test) SELF_TEST=1; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

detect_target() {
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"
  case "$os" in
    linux*) os="linux" ;;
    darwin*) os="macos" ;;
    *) echo "Unsupported OS: $os" >&2; exit 1 ;;
  esac
  case "$arch" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
  esac
  printf '%s-%s\n' "$os" "$arch"
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print tolower($1)}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print tolower($1)}'
  else
    echo "Refusing install: sha256sum or shasum is required." >&2
    exit 1
  fi
}

expected_hash() {
  awk -v target="$2" '
    {
      h = tolower($1)
      name = $2
      sub(/^\*/, "", name)
      if (name == target && h ~ /^[0-9a-f]{64}$/) { print h; exit 0 }
    }
  ' "$1"
}

verify_checksum() {
  file_path="$1"
  asset_name="$2"
  sums_file="$3"
  expected="$(expected_hash "$sums_file" "$asset_name")"
  if [ -z "$expected" ]; then
    echo "Refusing install: $asset_name is missing from SHA256SUMS." >&2
    return 1
  fi
  actual="$(sha256_file "$file_path")"
  if [ "$actual" != "$expected" ]; then
    echo "Refusing install: SHA-256 mismatch for $asset_name (expected $expected, got $actual)." >&2
    return 1
  fi
}

install_from_stage() {
  stage="$1"
  target="$2"
  sums="$stage/SHA256SUMS"
  [ -f "$sums" ] || { echo "Refusing install: SHA256SUMS not found in $stage." >&2; return 1; }

  archive=""
  for cand in "$stage"/superframe-playground-*.tar.gz "$stage"/superframe-playground-*.zip; do
    if [ -f "$cand" ]; then archive="$cand"; break; fi
  done
  [ -n "$archive" ] || { echo "Refusing install: no Superframe Playground archive found." >&2; return 1; }
  verify_checksum "$archive" "$(basename "$archive")" "$sums" || return 1

  bundle_dir="$target/bundle"
  bin_dir="$target/bin"
  rm -rf "$bundle_dir"
  mkdir -p "$bundle_dir" "$bin_dir"
  case "$archive" in
    *.tar.gz) tar -xzf "$archive" -C "$bundle_dir" ;;
    *.zip) unzip -qo "$archive" -d "$bundle_dir" ;;
    *) echo "Refusing install: unsupported archive format $archive" >&2; return 1 ;;
  esac

  cli="$(find "$bundle_dir" -name 'superframe.mjs' -type f | head -n 1 || true)"
  if [ -n "$cli" ]; then
    cat > "$bin_dir/superframe" <<EOF
#!/usr/bin/env sh
exec node "$cli" "\$@"
EOF
    chmod +x "$bin_dir/superframe"
  fi

  native_cli="$(find "$bundle_dir" -name 'raw_native_cli' -type f | head -n 1 || true)"
  if [ -n "$native_cli" ]; then
    cp "$native_cli" "$bin_dir/raw_native_cli"
    chmod +x "$bin_dir/raw_native_cli"
  fi

  cp "$sums" "$target/SHA256SUMS"
  if [ "$NO_PATH" -eq 0 ] && [ -n "${HOME:-}" ]; then
    for rc in "$HOME/.profile" "$HOME/.bashrc" "$HOME/.zshrc"; do
      if [ -f "$rc" ] && ! grep -Fq "$bin_dir" "$rc"; then
        printf '\nexport PATH="%s:$PATH"\n' "$bin_dir" >> "$rc"
      fi
    done
  fi

  echo "Superframe Playground verified (SHA256SUMS OK) and installed to: $target"
  echo "CLI bin directory: $bin_dir"
  if [ "$WITH_RAW_DX12" -eq 1 ]; then
    echo "Optional RAW DX12 game runtime binaries (Windows/DX12): download the release archive + SHA256SUMS from https://github.com/$REPO/releases or Nexus Mods and verify checksums before installation."
  fi
}

run_self_test() {
  tmp="$(mktemp -d 2>/dev/null || mktemp -d -t superframe-selftest)"
  trap 'rm -rf "$tmp"' EXIT INT TERM
  stage="$tmp/stage"
  mkdir -p "$stage" "$tmp/payload/superframe/cli" "$tmp/payload/native/bin"
  printf 'console.log("superframe selftest ok");\n' > "$tmp/payload/superframe/cli/superframe.mjs"
  printf '#!/usr/bin/env sh\necho "raw_native_cli selftest ok"\n' > "$tmp/payload/native/bin/raw_native_cli"
  chmod +x "$tmp/payload/native/bin/raw_native_cli"

  arc="$stage/superframe-playground-linux-x64.tar.gz"
  tar -czf "$arc" -C "$tmp/payload" .
  printf '%s  superframe-playground-linux-x64.tar.gz\n' "$(sha256_file "$arc")" > "$stage/SHA256SUMS"

  NO_PATH=1
  install_from_stage "$stage" "$tmp/dest_ok"
  [ -x "$tmp/dest_ok/bin/superframe" ] || { echo "Self-test failed: superframe shim missing." >&2; exit 1; }
  [ -x "$tmp/dest_ok/bin/raw_native_cli" ] || { echo "Self-test failed: raw_native_cli missing." >&2; exit 1; }

  # Planted 1-byte tamper control: must fail closed before extracting.
  python3 -c '
import sys
p = sys.argv[1]
b = bytearray(open(p, "rb").read())
b[-1] ^= 0x01
open(p, "wb").write(b)
' "$arc"

  if install_from_stage "$stage" "$tmp/dest_bad" >/dev/null 2>&1; then
    echo "Self-test failed: tampered archive was not refused." >&2
    exit 1
  fi
  [ ! -f "$tmp/dest_bad/bin/superframe" ] || { echo "Self-test failed: tampered archive extracted." >&2; exit 1; }
  echo "SELFTEST PASS: valid install verified and planted 1-byte tamper refused."
}

if [ "$SELF_TEST" -eq 1 ]; then
  run_self_test
  exit 0
fi

if [ -n "$FROM_DIR" ]; then
  install_from_stage "$FROM_DIR" "$INSTALL_DIR"
  exit 0
fi

target_triple="$(detect_target)"
if [ "$VERSION" = "latest" ]; then
  api="https://api.github.com/repos/$REPO/releases/latest"
else
  case "$VERSION" in v*) tag="$VERSION" ;; *) tag="v$VERSION" ;; esac
  api="https://api.github.com/repos/$REPO/releases/tags/$tag"
fi

tmp="$(mktemp -d 2>/dev/null || mktemp -d -t superframe-install)"
trap 'rm -rf "$tmp"' EXIT INT TERM
meta="$tmp/release.json"
curl -fsSL -H "Accept: application/vnd.github+json" -H "User-Agent: superframe-installer" "$api" -o "$meta"

urls="$(python3 -c '
import json, sys
triple = sys.argv[2]
assets = json.load(open(sys.argv[1], encoding="utf-8")).get("assets", [])
by_name = {a["name"]: a["browser_download_url"] for a in assets}
pick = []
if "SHA256SUMS" in by_name: pick.append(("SHA256SUMS", by_name["SHA256SUMS"]))
for cand in (f"superframe-playground-{triple}.tar.gz", f"superframe-playground-{triple}.zip"):
    if cand in by_name:
        pick.append((cand, by_name[cand]))
        break
for n, u in pick:
    print(f"{n}\t{u}")
' "$meta" "$target_triple")"

printf '%s\n' "$urls" | while IFS='	' read -r name url; do
  [ -n "$name" ] && curl -fsSL "$url" -o "$tmp/$name"
done
install_from_stage "$tmp" "$INSTALL_DIR"
