#!/usr/bin/env bash
set -euo pipefail

site_host=${1:?Provide a DNS host pointing at this server}
[[ "$site_host" =~ ^[a-zA-Z0-9.-]+$ ]]
node_cni_ip=$(ip -4 -o addr show dev cni0 | awk '{split($4, address, "/"); print address[1]; exit}')
[[ "$node_cni_ip" =~ ^[0-9.]+$ ]]
cd /srv/lian-one

if [[ ! -x /opt/lian-one-node/bin/node ]]; then
  node_version=v24.15.0
  node_archive="node-${node_version}-linux-x64.tar.xz"
  staging_dir=$(mktemp -d)
  trap 'rm -rf "$staging_dir"' EXIT
  (
    cd "$staging_dir"
    curl -fsSLO "https://nodejs.org/dist/${node_version}/${node_archive}"
    curl -fsSLO "https://nodejs.org/dist/${node_version}/SHASUMS256.txt"
    awk -v archive="$node_archive" '$2 == archive' SHASUMS256.txt | sha256sum --check -
  )
  sudo install -d /opt/lian-one-node
  sudo tar -xJf "$staging_dir/$node_archive" --strip-components=1 -C /opt/lian-one-node
fi
export PATH="/opt/lian-one-node/bin:$PATH"
npm ci --no-audit --no-fund
npm run build

if ! sudo test -e /etc/lian-one.env; then
  sudo bash -c '
    umask 077
    {
      printf "ADMIN_PASSWORD=%s\n" "$(openssl rand -hex 20)"
      printf "DRIVER_CREDENTIALS='\''{\"d1\":\"%s\"}'\''\n" "$(openssl rand -hex 20)"
      printf "TELEMETRY_KEY=%s\n" "$(openssl rand -hex 32)"
      printf "LIAN_INGRESS_IP=%s\n" "$1"
      printf "PORT=3100\nLIAN_TRUST_PROXY=true\nLIAN_SAMPLE_DATA=true\nLIAN_DB_PATH=/var/lib/lian-one/park.sqlite\n"
    } > /etc/lian-one.env
  ' lian-env "$node_cni_ip"
fi
sudo install -m 0644 deploy/lian-one.service /etc/systemd/system/lian-one.service
sudo systemctl daemon-reload
sudo systemctl enable lian-one.service
sudo systemctl restart lian-one.service
for attempt in {1..15}; do
  if curl -fsS http://127.0.0.1:3100/api/health; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:3100/api/health >/dev/null
sed -e "s/__NODE_CNI_IP__/$node_cni_ip/g" -e "s/__SITE_HOST__/$site_host/g" deploy/zeabur-ingress.yaml | sudo k3s kubectl apply -f -
