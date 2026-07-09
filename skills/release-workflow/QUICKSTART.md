# Quick Start Guide

## Using the Release Workflow Skill

This guide provides a quick start for using the release workflow skill.

## Prerequisites

- Docker installed and configured
- Kubernetes cluster access
- Container registry credentials
- LWP project cloned locally

## Step 1: Navigate to Project

```bash
cd /opt/lwp
```

## Step 2: Check Help

```bash
# See release script options
./skills/release-workflow/scripts/release.sh --help

# See verification script usage
./skills/release-workflow/scripts/verify.sh
```

## Step 3: Test with Dry Run

```bash
# Test the release process without making changes
./skills/release-workflow/scripts/release.sh --version 1.0.0 --dry-run

# This shows all commands that will be executed
# Review the output to ensure everything looks correct
```

## Step 4: Execute Release

```bash
# Run the actual release
./skills/release-workflow/scripts/release.sh --version 1.0.0

# This will:
# 1. Build backend and frontend images
# 2. Build container images
# 3. Push all images to registry
# 4. Update Kubernetes manifests
# 5. Deploy to Kubernetes
# 6. Run database migrations
# 7. Verify deployment
```

## Step 5: Verify Deployment

```bash
# Run comprehensive verification
./skills/release-workflow/scripts/verify.sh

# Check for green checkmarks (✓) for all tests
```

## Step 6: Register Apps (Manual)

```bash
# Log in to admin panel
# Navigate to Apps → Add App

# Add each app with:
# - Container image: registry.example.com/lwp/{app}:1.0.0
# - Proxy port: 8080
# - App type: stream
# - SHM size: 1Gi

# Click "Pull image" for each app
```

## Step 7: Create Release Notes

```bash
# Use the template
cp skills/release-workflow/templates/CHANGELOG.md .

# Edit with your changes
$EDITOR CHANGELOG.md

# Commit the changes
git add CHANGELOG.md
git commit -m "docs: add release notes for 1.0.0"
```

## Step 8: Tag Release

```bash
# Create git tag
git tag -a v1.0.0 -m "Release 1.0.0"

# Push tag
git push origin v1.0.0
```

## Common Commands

### Build all images
```bash
cd containers
make all REGISTRY=registry.example.com TAG=1.0.0
```

### Push all images
```bash
cd containers
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

### Check deployment status
```bash
kubectl get pods -n lwp
kubectl rollout status deployment/backend -n lwp
```

## Troubleshooting

### Image push failures
```bash
# Check Docker login
docker login registry.example.com

# Verify credentials
cat compose/.env | grep REGISTRY
```

### Deployment issues
```bash
# Check pod status
kubectl describe pods -n lwp

# Check logs
kubectl logs -n lwp deploy/backend
```

### Migration errors
```bash
# Check current migration
kubectl exec -n lwp deploy/backend -- alembic current

# Check migration history
kubectl exec -n lwp deploy/backend -- alembic history
```

## Version Bump Guide

- **PATCH** (1.0.1): Bug fixes, security patches
- **MINOR** (1.1.0): New features, backward compatible
- **MAJOR** (2.0.0): Breaking changes, incompatible API

## Need More Help?

- See `SKILL.md` for complete documentation
- See `EXAMPLES.md` for usage scenarios
- See `DEMO.md` for step-by-step walkthrough
- Run `./scripts/release.sh --help` for command options

## Support

For issues or questions:
1. Check the documentation files
2. Review the test output
3. Examine the dry run output
4. Contact the development team
