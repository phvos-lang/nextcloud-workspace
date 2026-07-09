#!/bin/bash
# Automated release script for LWP

set -e

# Configuration
REGISTRY="registry.example.com"
PROJECT_DIR="/opt/lwp"
CONTAINERS_DIR="$PROJECT_DIR/containers"
K8S_DIR="$PROJECT_DIR/k8s/overlays/prod"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --version|-v)
            VERSION="$2"
            shift 2
            ;;
        --dry-run|-n)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 --version VERSION [--dry-run]"
            echo "  --version VERSION  : Release version (e.g., 1.0.0)"
            echo "  --dry-run          : Show commands without executing"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

if [[ -z "$VERSION" ]]; then
    echo "Error: Version is required"
    echo "Usage: $0 --version 1.0.0"
    exit 1
fi

echo "=== LWP Release $VERSION ==="
echo "Registry: $REGISTRY"
echo "Dry run: ${DRY_RUN:-false}"
echo ""

# Dry run function
exec_cmd() {
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "[DRY RUN] $@"
    else
        echo "$ $@"
        $@
    fi
}

# Step 1: Build platform images
echo "=== Step 1: Building platform images ==="
cd "$PROJECT_DIR"

exec_cmd docker build -t "$REGISTRY/lwp/backend:$VERSION" backend/
exec_cmd docker build -t "$REGISTRY/lwp/frontend:$VERSION" frontend/

echo ""

# Step 2: Build container images
echo "=== Step 2: Building container images ==="
cd "$CONTAINERS_DIR"

exec_cmd make base REGISTRY=$REGISTRY TAG=$VERSION
exec_cmd make all REGISTRY=$REGISTRY TAG=$VERSION

echo ""

# Step 3: Push images
echo "=== Step 3: Pushing images ==="
cd "$PROJECT_DIR"

exec_cmd docker push "$REGISTRY/lwp/backend:$VERSION"
exec_cmd docker push "$REGISTRY/lwp/frontend:$VERSION"

cd "$CONTAINERS_DIR"
exec_cmd make push REGISTRY=$REGISTRY TAG=$VERSION

echo ""

# Step 4: Update Kubernetes manifests
echo "=== Step 4: Updating Kubernetes manifests ==="
cd "$K8S_DIR"

# Update kustomization.yaml
if [[ "$DRY_RUN" != "true" ]]; then
    sed -i "s/newTag: \".*\"$/newTag: \"$VERSION\"/" kustomization.yaml
    echo "Updated kustomization.yaml with version $VERSION"
    git diff kustomization.yaml || echo "No changes to kustomization.yaml"
else
    echo "[DRY RUN] Would update kustomization.yaml"
fi

echo ""

# Step 5: Deploy to Kubernetes
echo "=== Step 5: Deploying to Kubernetes ==="

exec_cmd kubectl apply -k "$K8S_DIR"
exec_cmd kubectl rollout status deployment/backend -n lwp
exec_cmd kubectl rollout status deployment/frontend -n lwp
exec_cmd kubectl rollout status deployment/nginx -n lwp

echo ""

# Step 6: Run migrations
echo "=== Step 6: Running database migrations ==="

exec_cmd kubectl exec -n lwp deploy/backend -- alembic upgrade head

echo ""

# Step 7: Verify deployment
echo "=== Step 7: Verifying deployment ==="

exec_cmd kubectl get pods -n lwp
exec_cmd curl -k https://lwp.example.com/healthz

echo ""
echo "=== Release $VERSION complete ==="
