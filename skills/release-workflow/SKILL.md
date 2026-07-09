# Release Workflow Skill

## Description
Automates the release process for Nextcloud Linux Workspace (LWP). Handles versioning, container image building, tagging, pushing to registry, Kubernetes deployment updates, and documentation. Use this skill whenever preparing a release, cutting a new version, or deploying to production.

## Compatibility
- Docker
- Kubernetes (kubectl + kustomize)
- Make
- Git

## Release Process Overview

### 1. Versioning Strategy
- Semantic versioning (MAJOR.MINOR.PATCH)
- Version stored in `k8s/overlays/prod/kustomization.yaml` (image tags)
- Backend and frontend images tagged together
- Container images tagged separately

### 2. Release Steps
1. **Prepare**: Update version, build images, test
2. **Tag and push**: Push all images to registry
3. **Deploy**: Update Kubernetes manifests and apply
4. **Verify**: Check deployment health and run migrations
5. **Document**: Update changelog and release notes

## Detailed Workflow

### Step 1: Prepare Release

#### Determine version bump type
```bash
# Check git log for changes since last release
git log --oneline --since="$(git describe --tags --abbrev=0)"..HEAD
```

#### Update version in Kubernetes manifests
```bash
# Edit k8s/overlays/prod/kustomization.yaml
# Change image tags from old version to new version
```

### Step 2: Build and Push Container Images

#### Build platform images (backend + frontend)
```bash
# Backend
cd /opt/lwp
docker build -t registry.example.com/lwp/backend:VERSION backend/
docker push registry.example.com/lwp/backend:VERSION

# Frontend
cd /opt/lwp
docker build -t registry.example.com/lwp/frontend:VERSION frontend/
docker push registry.example.com/lwp/frontend:VERSION
```

#### Build app container images
```bash
cd /opt/lwp/containers

# Build base first
make base REGISTRY=registry.example.com TAG=VERSION

# Build all apps
make all REGISTRY=registry.example.com TAG=VERSION

# Or build specific apps
make firefox REGISTRY=registry.example.com TAG=VERSION
make vivaldi REGISTRY=registry.example.com TAG=VERSION
```

### Step 3: Deploy to Kubernetes

#### Update image tags in kustomization
```bash
# Edit k8s/overlays/prod/kustomization.yaml
images:
  - name: registry.example.com/lwp/backend
    newTag: "VERSION"
  - name: registry.example.com/lwp/frontend
    newTag: "VERSION"
```

#### Apply deployment
```bash
kubectl apply -k k8s/overlays/prod/

# Watch rollout
kubectl rollout status deployment/backend -n lwp
kubectl rollout status deployment/frontend -n lwp
kubectl rollout status deployment/nginx -n lwp
```

### Step 4: Run Migrations

```bash
kubectl exec -n lwp deploy/backend -- alembic upgrade head
```

### Step 5: Register App Images in Admin Panel

Log in as admin → **Apps** → **Add App** for each session container:
- Container image: `registry.example.com/lwp/{app}:VERSION`
- Proxy port: `8080`
- App type: `stream`
- SHM size: `1Gi`

Click **Pull image** to pre-pull on all nodes.

### Step 6: Verify Deployment

```bash
kubectl get pods -n lwp
curl -k https://lwp.example.com/healthz
```

## Release Checklist

1. [ ] Determine version bump (major/minor/patch)
2. [ ] Update version in kustomization.yaml
3. [ ] Build backend image
4. [ ] Build frontend image
5. [ ] Build base container image
6. [ ] Build all app container images
7. [ ] Push all images to registry
8. [ ] Update kustomization.yaml with new tags
9. [ ] Apply Kubernetes deployment
10. [ ] Run database migrations
11. [ ] Register app images in admin panel
12. [ ] Verify deployment health
13. [ ] Create release notes
14. [ ] Tag git repository

## Common Commands

### Build all images
```bash
cd /opt/lwp/containers
make all REGISTRY=registry.example.com TAG=1.0.0
```

### Push all images
```bash
cd /opt/lwp/containers
make push REGISTRY=registry.example.com TAG=1.0.0
```

### Deploy to Kubernetes
```bash
kubectl apply -k k8s/overlays/prod/
```

### Run migrations
```bash
kubectl exec -n lwp deploy/backend -- alembic upgrade head
```

## Troubleshooting

### Image push failures
- Verify Docker login: `docker login registry.example.com`
- Check registry credentials in `.env`
- Ensure images are built before pushing

### Deployment stuck
```bash
kubectl describe pods -n lwp
kubectl logs -n lwp deploy/backend
```

### Migration errors
```bash
kubectl exec -n lwp deploy/backend -- alembic history
kubectl exec -n lwp deploy/backend -- alembic current
```

## Best Practices

1. **Test before production**: Always test in staging environment first
2. **Rollback plan**: Keep previous version images available
3. **Blue-green deployment**: Use Kubernetes rolling updates for zero downtime
4. **Monitor**: Check Prometheus metrics after deployment
5. **Communicate**: Notify team before and after deployment

## Version Bump Guide

- **MAJOR**: Breaking changes, incompatible API changes
- **MINOR**: Backward-compatible new features
- **PATCH**: Backward-compatible bug fixes

## Example Release Process

```bash
# 1. Determine version
CURRENT=$(grep "newTag" k8s/overlays/prod/kustomization.yaml | awk '{print $2}' | tr -d '"')
NEW_VERSION="1.0.1"  # Based on changes

# 2. Build images
cd containers
make all REGISTRY=registry.example.com TAG=$NEW_VERSION

# 3. Push images
make push REGISTRY=registry.example.com TAG=$NEW_VERSION

# 4. Update kustomization
sed -i "s/newTag: \".*\"$/newTag: \"$NEW_VERSION\"/" ../k8s/overlays/prod/kustomization.yaml

# 5. Deploy
kubectl apply -k ../k8s/overlays/prod/

# 6. Run migrations
kubectl exec -n lwp deploy/backend -- alembic upgrade head

# 7. Verify
docker pull registry.example.com/lwp/backend:$NEW_VERSION
kubectl get pods -n lwp
```
