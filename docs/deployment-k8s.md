# Kubernetes Deployment

## Prerequisites

- Kubernetes 1.28+
- `kubectl` with `kustomize` (built-in since kubectl 1.14)
- Container registry accessible from all cluster nodes
- StorageClass with `ReadWriteOnce` for postgres/redis PVCs
- StorageClass with `ReadWriteMany` for user home PVCs (NFS, CephFS, Longhorn RWX, etc.)
- LoadBalancer or Ingress for external access
- TLS certificate and key for your domain (bring-your-own — no ACME)

---

## 1. Build and push images

### Platform images (backend + frontend + nginx)

```bash
# Backend
docker build -t registry.example.com/lwp/backend:1.0.0 backend/
docker push registry.example.com/lwp/backend:1.0.0

# Frontend
docker build -t registry.example.com/lwp/frontend:1.0.0 frontend/
docker push registry.example.com/lwp/frontend:1.0.0
```

### App container images

```bash
cd containers

# Build base first (other images depend on it)
docker build -t registry.example.com/lwp/vnc-base:1.0.0 kasm-base/
docker push registry.example.com/lwp/vnc-base:1.0.0

# Per-app images
docker build --build-arg BASE=registry.example.com/lwp/vnc-base:1.0.0 \
  -t registry.example.com/lwp/firefox:1.0.0 firefox/
docker push registry.example.com/lwp/firefox:1.0.0

# Or build all with the Makefile:
make all REGISTRY=registry.example.com TAG=1.0.0
```

> **Session containers** (`lwp-firefox`, `lwp-chromium`, etc.) are **not** K8s Deployments — they are ephemeral Pods created per-session by the backend. The backend uses `kubernetes-asyncio` with its ServiceAccount to create/delete them.

---

## 2. Create secrets

```bash
cp k8s/overlays/prod/secrets.yaml.example k8s/overlays/prod/secrets.yaml
# Edit secrets.yaml — fill in all CHANGE_ME values

# TLS cert/key (base64-encoded):
echo -n "$(base64 -w0 < your-cert.pem)" # → tls.crt
echo -n "$(base64 -w0 < your-key.pem)"  # → tls.key

kubectl apply -f k8s/overlays/prod/secrets.yaml
```

Required secret keys:

| Key | Description |
|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `SECRET_KEY` | JWT signing key (≥32 random bytes) |
| `OIDC_ISSUER` | OIDC provider URL (if using OIDC) |
| `OIDC_CLIENT_ID` | |
| `OIDC_CLIENT_SECRET` | |
| `tls.crt` | TLS certificate (PEM) |
| `tls.key` | TLS private key (PEM) |

---

## 3. Update image tags

Edit `k8s/overlays/prod/kustomization.yaml`:

```yaml
images:
  - name: registry.example.com/lwp/backend
    newTag: "1.0.0"
  - name: registry.example.com/lwp/frontend
    newTag: "1.0.0"
```

---

## 4. Configure backend env

Set these in `k8s/overlays/prod/configmap.yaml` or as Secret values:

```env
# Required
AUTH_METHODS=oidc                          # or oidc,local,ldap
LWP_BASE_URL=https://lwp.example.com
LWP_ENV=production
BACKEND_INTERNAL_URL=http://backend.lwp.svc.cluster.local:8000

# Session app images
# (register these in the admin panel after deploy — no config file needed)

# Optional
MAX_SESSIONS_PER_USER=2
SESSION_TIMEOUT_HOURS=8
```

---

## 5. Deploy

```bash
kubectl apply -k k8s/overlays/prod/

# Watch rollout
kubectl rollout status deployment/backend  -n lwp
kubectl rollout status deployment/frontend -n lwp
kubectl rollout status deployment/nginx    -n lwp
```

---

## 6. Run migrations

```bash
kubectl exec -n lwp deploy/backend -- alembic upgrade head
```

Run after every update that includes new migration files.

---

## 7. Register app images

Log in as admin → **Apps** → **Add App** for each session container image:

| Field | Firefox example |
|---|---|
| Container image | `registry.example.com/lwp/firefox:1.0.0` |
| Proxy port | `8080` |
| App type | `stream` |
| SHM size | `1Gi` |

After adding, click **Pull image** to pre-pull on all nodes and avoid cold-start delay.

---

## 8. Verify

```bash
kubectl get pods -n lwp
# backend, frontend, nginx, postgres, redis — all Running

curl -k https://lwp.example.com/healthz
# {"status":"ok","env":"production"}
```

---

## Updating

```bash
# 1. Build + push new images
# 2. Bump tags in kustomization.yaml
kubectl apply -k k8s/overlays/prod/
kubectl rollout status deployment/backend -n lwp
# 3. Run migrations if needed
kubectl exec -n lwp deploy/backend -- alembic upgrade head
```

---

## Scaling

**Backend** — HPA scales 2–8 replicas at 70% CPU. Stateless; all state in PostgreSQL + Redis.

**Nginx** — scale manually if needed:
```bash
kubectl scale deployment nginx -n lwp --replicas=3
```

**Session pods** — one pod per active session; not managed by a Deployment. Created by backend on demand, deleted on session end. They do not autoscale.

---

## Persistent home directories

When `mount_home=true` on an app, LWP automatically creates a PVC named `lwp-home-{user_id}` on first session launch and mounts it at `/home/lwp` inside the container. Firefox and Thunderbird profiles, browser data, and the symlinked XDG dirs (Documents, Downloads, etc.) all live here.

### First boot — skeleton init

K8s PVCs start empty, unlike Docker named volumes. `lwp-start-kasm.sh` handles this: on first launch it copies the baked-in skeleton (VNC config, PulseAudio config, GTK theme) from `/etc/lwp/skel/` into the empty PVC and writes a `.lwp-initialized` sentinel so it never runs again. Firefox and Thunderbird will create their own profile directories on first run.

### Storage class

By default PVCs use `standard` (ReadWriteOnce). Configure in `.env`:

```env
HOME_STORAGE_CLASS=standard   # or your RWX class
HOME_PVC_SIZE=5Gi
```

**ReadWriteOnce** works for single-node clusters and the common case where each user only has one active session. Most CSI drivers also allow multiple pods on the **same node** to mount the same RWO PVC.

**ReadWriteMany** (NFS, CephFS, Longhorn RWX) is needed if:
- Users run two sessions simultaneously on different nodes, or
- You run a multi-replica backend that creates pods anywhere in the cluster

### Manual pre-creation (optional)

PVCs are created automatically, but you can pre-create them with a different size or storage class:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: lwp-home-<user-uuid>
  namespace: lwp
  labels:
    lwp.managed: "true"
    lwp.user: <user-uuid>
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: fast-nvme
  resources:
    requests:
      storage: 20Gi
```

### Cleanup

PVCs are not deleted when a user's sessions end — they persist until you explicitly delete them. To delete a user's home PVC:

```bash
kubectl delete pvc -n lwp lwp-home-<user-uuid>
```

---

## RBAC

The backend ServiceAccount needs permission to create/delete Pods and Services in the `lwp` namespace (for session lifecycle). This is already defined in `k8s/base/rbac.yaml`.

---

## PostgreSQL backup

```bash
# Manual dump
kubectl exec -n lwp statefulset/postgres -- \
  pg_dump -U lwp lwp | gzip > backup-$(date +%F).sql.gz

# Restore
gunzip < backup.sql.gz | \
  kubectl exec -i -n lwp statefulset/postgres -- psql -U lwp lwp
```

For automated backups, deploy a CronJob that runs `pg_dump` and uploads to object storage (S3, MinIO, etc.).
