# Production deployment

## Before starting

Open TCP ports 80 and 443 in the cloud firewall and point the domain's DNS at the
server. Have an Ubuntu 24.04 server, passwordless sudo, the repository and Docker.
Run commands from the repository root. Copy `.env.example` to `.env` and replace
its placeholders with your domain and optional contact email. An empty email registers
without one; expiry notices will not be emailed. Never commit `.env`.

## Code, data and image

Clone the repository, then check out the intended release. The committed `data/derived/`
is included in the image and suffices for catalog sites. Custom coordinates in terrain
coverage additionally need the uncommitted prepared maps (about 451 MB). From the
machine holding them, with placeholders replaced:

```sh
rsync -av data/prepared/ ubuntu@SERVER:~/TrueSouth/data/prepared/
```

Install Docker on the server: `sh deploy/install-docker.sh`. Use `sudo` for Docker
commands. Log in to a registry first if your image requires authentication.

Two image choices:

1. Recommended on this 2 vCPU / 3.8 GB machine: build on a larger machine from the
   same checkout, then stream the image to the server:
   ```sh
   docker build -t truesouth:custom .
   docker save truesouth:custom | ssh ubuntu@SERVER 'sudo docker load'
   ```
2. Or build on the server: `sudo docker compose -f compose.prod.yaml build truesouth`.
   The Node/Vite build has not been memory-profiled here; it can consume multiple GB
   alongside Docker and the OS, so on 3.8 GB it risks being killed. Allow ample disk
   for build layers on the 19 GB disk.

## First start and certificate

The production Compose file is standalone: it avoids inheriting the development
host port. It uses a fixed private Docker subnet; change it and the matching trusted
proxy address together if that subnet conflicts with the host network. Start with:

```sh
sudo sh deploy/first-certificate.sh --staging
sudo sh deploy/first-certificate.sh
sudo sh deploy/update.sh
```

The first command proves HTTP validation with Let's Encrypt staging. Staging uses a
separate certificate lineage and does not enable TLS. The second requests the real
certificate and restarts nginx to enable TLS. Until then nginx serves challenges and
redirects other HTTP requests. Re-running the scripts retains existing certificates
and volumes. Never use staging certificates as proof of public trust.

## Check and operate

Replace DOMAIN with the configured domain:

```sh
curl -I http://DOMAIN/
curl -fsS https://DOMAIN/api/health
sudo docker compose -f compose.prod.yaml exec nginx nginx -t
sudo docker compose -f compose.prod.yaml run --rm --no-deps --entrypoint certbot certbot renew --dry-run
```

The first command prints `301` and an HTTPS Location. Health prints JSON; inspect
`status` and `custom_sites`, since HTTP 200 only means the API answered. nginx reports
syntax and configuration success. The dry run reports simulated renewal success.
The certbot container checks renewal every 12 hours; nginx reloads every six hours to
pick up new files. Check logs regularly:

```sh
sudo docker compose -f compose.prod.yaml logs --tail=100 truesouth nginx certbot
```

HSTS lasts one day, without includeSubDomains or preload. No CSP is supplied because
it has not been verified against the running app through nginx. TLS uses 1.2/1.3 and
OCSP stapling when the issuer supplies an OCSP responder. gzip covers text and JSON,
not images or opaque `.bin` data. In one local measurement `system.bin` was 1,262,016
bytes and gzip produced 1,030,332 bytes; the saving does not justify compressing
opaque binary data on every request on this small server. POST requests enqueue terrain
work and are polled;
nginx uses a 16 KiB body limit, 5-second connect timeout and 30-second read/send
timeouts. The API itself limits custom-site bodies to 4096 bytes.

## Updates and rollback

Build or transfer a new image under a distinct tag, update `TRUESOUTH_IMAGE` in `.env`,
and run `sudo sh deploy/update.sh`. If using a registry, first run
`sudo docker compose -f compose.prod.yaml pull truesouth`. To roll back, restore the
previous image tag in `.env` and run `sudo sh deploy/update.sh` again. Keep the previous
image available. The scripts do not delete volumes; cached sites and certificates persist.

The custom cache has a 2 GiB default disk limit and does not evict completed sites;
monitor free disk and health. Prepared maps are memory-mapped; architecture estimates
about 1 GB for the API. There is no measured peak memory for a terrain job on this
server, so whether 3.8 GB suffices for one job cannot be determined; monitor peak RAM
and disk under a representative job before relying on it. Terrain jobs run one at a
time; sphere builds can run independently.
