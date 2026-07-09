#!/bin/bash
# Deployment verification script for LWP

set -e

echo "=== LWP Deployment Verification ==="
echo ""

# Check Kubernetes pods
echo "1. Checking Kubernetes pods..."
pods=$(kubectl get pods -n lwp --no-headers | grep -v "Running")
if [[ -z "$pods" ]]; then
    echo "✓ All pods are running"
else
    echo "✗ Some pods are not running:"
    echo "$pods"
    exit 1
fi

# Check backend service
echo ""
echo "2. Checking backend service..."
backend_status=$(kubectl get svc backend -n lwp --no-headers | awk '{print $4}')
if [[ "$backend_status" == "ClusterIP" ]]; then
    echo "✓ Backend service is available"
else
    echo "✗ Backend service issue"
    exit 1
fi

# Check frontend service
echo ""
echo "3. Checking frontend service..."
frontend_status=$(kubectl get svc frontend -n lwp --no-headers | awk '{print $4}')
if [[ "$frontend_status" == "ClusterIP" ]]; then
    echo "✓ Frontend service is available"
else
    echo "✗ Frontend service issue"
    exit 1
fi

# Check nginx service
echo ""
echo "4. Checking nginx service..."
nginx_status=$(kubectl get svc nginx -n lwp --no-headers | awk '{print $4}')
if [[ "$nginx_status" == "LoadBalancer" ]]; then
    echo "✓ Nginx service is available"
else
    echo "✗ Nginx service issue"
    exit 1
fi

# Check health endpoint
echo ""
echo "5. Checking health endpoint..."
health_response=$(curl -k -s https://lwp.example.com/healthz)
if echo "$health_response" | grep -q "\"status\":\"ok\""; then
    echo "✓ Health endpoint is healthy"
else
    echo "✗ Health endpoint returned unexpected response:"
    echo "$health_response"
    exit 1
fi

# Check database connection
echo ""
echo "6. Checking database connection..."
if kubectl exec -n lwp deploy/backend -- python -c "from app.database import get_session; import asyncio; asyncio.run(get_session().connect()); print('DB OK')" 2>/dev/null | grep -q "DB OK"; then
    echo "✓ Database connection is working"
else
    echo "✗ Database connection failed"
    exit 1
fi

# Check Redis connection
echo ""
echo "7. Checking Redis connection..."
if kubectl exec -n lwp deploy/backend -- python -c "import redis; r = redis.Redis(host='redis', port=6379); r.ping(); print('Redis OK')" 2>/dev/null | grep -q "Redis OK"; then
    echo "✓ Redis connection is working"
else
    echo "✗ Redis connection failed"
    exit 1
fi

# Check migrations
echo ""
echo "8. Checking database migrations..."
migration_status=$(kubectl exec -n lwp deploy/backend -- alembic current 2>/dev/null | grep "head")
if [[ -n "$migration_status" ]]; then
    echo "✓ Database migrations are up to date"
else
    echo "✗ Database migrations need to be run"
    exit 1
fi

# Check container images
echo ""
echo "9. Checking container images..."
images_ok=true
for app in firefox vivaldi thunderbird libreoffice terminator; do
    if ! docker inspect "registry.example.com/lwp/$app:latest" >/dev/null 2>&1; then
        echo "✗ Image not found: registry.example.com/lwp/$app:latest"
        images_ok=false
    fi
done

if [[ "$images_ok" == "true" ]]; then
    echo "✓ All required container images are available"
else
    echo "✗ Some container images are missing"
    exit 1
fi

echo ""
echo "=== All checks passed! ==="
echo "Deployment is healthy and ready for use."
