#!/usr/bin/env bash
set -euo pipefail

SIGNING_DIR="$HOME/.local-climate-link/android"
KEYSTORE="$SIGNING_DIR/alpha.keystore"
PROPERTIES="$SIGNING_DIR/alpha-signing.properties"
ALIAS="localclimatealpha"

mkdir -p "$SIGNING_DIR"
chmod 700 "$SIGNING_DIR"

if [[ -e "$KEYSTORE" || -e "$PROPERTIES" ]]; then
  if [[ ! -f "$KEYSTORE" || ! -f "$PROPERTIES" ]]; then
    echo "Partial Local Climate Link alpha signing state. Remove both files in $SIGNING_DIR and retry." >&2
    exit 1
  fi
else
  PASSWORD="$(python3 -c 'import secrets; print(secrets.token_urlsafe(36))')"
  keytool -genkeypair \
    -keystore "$KEYSTORE" \
    -storetype PKCS12 \
    -storepass "$PASSWORD" \
    -keypass "$PASSWORD" \
    -alias "$ALIAS" \
    -keyalg RSA \
    -keysize 4096 \
    -validity 3650 \
    -dname "CN=Local Climate Link Alpha, OU=Local Climate Link, O=Local Climate Link, L=Warsaw, ST=Mazowieckie, C=PL" \
    >/dev/null 2>&1

  umask 077
  cat > "$PROPERTIES" <<EOF
storeFile=$KEYSTORE
storePassword=$PASSWORD
keyAlias=$ALIAS
keyPassword=$PASSWORD
EOF
fi

chmod 600 "$KEYSTORE" "$PROPERTIES"

read_property() {
  local key="$1"
  sed -n "s/^${key}=//p" "$PROPERTIES" | head -1
}

STORE_FILE="$(read_property storeFile)"
STORE_PASSWORD="$(read_property storePassword)"
KEY_ALIAS="$(read_property keyAlias)"
KEY_PASSWORD="$(read_property keyPassword)"

[[ -n "$STORE_FILE" && -n "$STORE_PASSWORD" && -n "$KEY_ALIAS" && -n "$KEY_PASSWORD" ]]
[[ -f "$STORE_FILE" ]]

printf '%s\n' 'Local Climate Link alpha signer:'
keytool -list -v \
  -keystore "$STORE_FILE" \
  -storepass "$STORE_PASSWORD" \
  -alias "$KEY_ALIAS" \
  -keypass "$KEY_PASSWORD" 2>/dev/null \
  | grep -E 'Owner:|SHA256:' \
  | head -2
