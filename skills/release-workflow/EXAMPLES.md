# Release Workflow Examples

This document provides practical examples of using the release workflow skill.

## Example 1: Simple Patch Release

```bash
# 1. Check what changed since last release
git log --oneline --since="$(git describe --tags --abbrev=0)"..HEAD

# 2. Run dry run to see what will happen
./skills/release-workflow/scripts/release.sh --version 1.0.1 --dry-run

# 3. Execute the release
./skills/release-workflow/scripts/release.sh --version 1.0.1

# 4. Verify deployment
./skills/release-workflow/scripts/verify.sh

# 5. Create release notes
cat > RELEASE_NOTES.md << 'EOF'
## [1.0.1] - 2024-01-15

### Fixed
- Fixed session timeout issue
- Fixed clipboard sync in Firefox
- Improved VPN connection stability
EOF
```

## Example 2: Minor Release with New Features

```bash
# 1. Build and test in staging first
export REGISTRY=registry.staging.example.com
export VERSION=1.1.0-rc1

./skills/release-workflow/scripts/release.sh --version $VERSION

# 2. Test thoroughly in staging
./skills/release-workflow/scripts/verify.sh

# 3. Deploy to production
export REGISTRY=registry.example.com
export VERSION=1.1.0

./skills/release-workflow/scripts/release.sh --version $VERSION

# 4. Update documentation
cp skills/release-workflow/templates/CHANGELOG.md .
# Edit CHANGELOG.md with new features
```

## Example 3: Emergency Security Patch

```bash
# 1. Create hotfix branch
git checkout -b hotfix/security-2024-01-15

# 2. Apply security fixes
# (apply patches, update dependencies, etc.)

# 3. Build and deploy immediately
./skills/release-workflow/scripts/release.sh --version 1.0.2 --dry-run
./skills/release-workflow/scripts/release.sh --version 1.0.2

# 4. Verify security fixes
./skills/release-workflow/scripts/verify.sh

# 5. Communicate to team
cat > SECURITY_NOTES.md << 'EOF'
## Security Advisory 2024-01-15

Fixed CVE-2024-XXXX: Session fixation vulnerability

Affected versions: < 1.0.2

Recommendation: Upgrade immediately
EOF
```

## Example 4: Version Bump Decision Guide

```bash
# Check git log to determine version bump
git log --oneline --since="$(git describe --tags --abbrev=0)"..HEAD | head -20

# Analyze changes to decide version type:
# MAJOR: Breaking changes, incompatible API changes
# MINOR: Backward-compatible new features
# PATCH: Backward-compatible bug fixes

# Example analysis:
# - Added new app: MINOR version
# - Fixed critical bug: PATCH version  
# - Changed API endpoint: MAJOR version
# - Security fix: PATCH version

# Based on analysis, choose version:
CURRENT=$(grep "newTag" k8s/overlays/prod/kustomization.yaml | awk '{print $2}' | tr -d '"')

if echo "$CHANGES" | grep -q "breaking\|incompatible\|API"; then
    NEW_VERSION=$(echo "$CURRENT" | awk -F. '{print $1+1 ".0.0"}')
elif echo "$CHANGES" | grep -q "feature\|new"; then
    NEW_VERSION=$(echo "$CURRENT" | awk -F. '{print $1 "." $2+1 ".0"}')
else
    NEW_VERSION=$(echo "$CURRENT" | awk -F. '{print $1 "." $2 "." $3+1}')
fi

echo "Recommended version: $NEW_VERSION"
```

## Example 5: Rolling Back a Release

```bash
# 1. Identify the issue
kubectl logs -n lwp deploy/backend | tail -50

# 2. Check previous version
PREVIOUS_VERSION=$(git describe --tags --abbrev=0 | sed 's/^v//')

# 3. Rollback Kubernetes deployment
kubectl set image deployment/backend \
    registry.example.com/lwp/backend:$PREVIOUS_VERSION -n lwp

kubectl set image deployment/frontend \
    registry.example.com/lwp/frontend:$PREVIOUS_VERSION -n lwp

# 4. Verify rollback
kubectl rollout status deployment/backend -n lwp
kubectl rollout status deployment/frontend -n lwp

# 5. Investigate and fix
# - Check logs for errors
# - Review recent changes
# - Create fix

# 6. Deploy fix as patch version
./skills/release-workflow/scripts/release.sh --version ${PREVIOUS_VERSION}.1
```

## Example 6: Preparing Release Notes

```bash
# 1. Generate release notes from git log
RELEASE_NOTES=$(git log --oneline --since="$(git describe --tags --abbrev=0)"..HEAD | \
    awk '{
        if ($0 ~ /feat:/) print "- " $0 "\n" >> "added"
        else if ($0 ~ /fix:/) print "- " $0 "\n" >> "fixed"
        else if ($0 ~ /BREAKING/) print "- " $0 "\n" >> "changed"
        else print "- " $0 "\n" >> "other"
    }'
)

# 2. Create structured release notes
cat > RELEASE_NOTES.md << EOF
## [VERSION] - $(date +%Y-%m-%d)

### Added
$(cat added 2>/dev/null || echo "- New features")

### Changed
$(cat changed 2>/dev/null || echo "- Improvements")

### Fixed
$(cat fixed 2>/dev/null || echo "- Bug fixes")

### Technical
- Updated dependencies
- Improved performance
- Enhanced security
EOF

# 3. Review and edit release notes
$EDITOR RELEASE_NOTES.md

# 4. Commit release notes
git add RELEASE_NOTES.md
git commit -m "docs: add release notes for VERSION"
```

## Example 7: Multi-Environment Deployment Strategy

```bash
# 1. Development environment
./skills/release-workflow/scripts/release.sh --version 1.0.0-dev

# 2. Staging environment
./skills/release-workflow/scripts/release.sh --version 1.0.0-rc1

# 3. Production environment
./skills/release-workflow/scripts/release.sh --version 1.0.0

# Alternative: Use environment variables
for ENV in dev staging prod; do
    REGISTRY=registry.$ENV.example.com
    VERSION=1.0.0-${ENV}
    
    if [ "$ENV" = "prod" ]; then
        VERSION=1.0.0
    fi
    
    ./skills/release-workflow/scripts/release.sh --version $VERSION
    ./skills/release-workflow/scripts/verify.sh
    
    # Add delay between environments
    if [ "$ENV" != "prod" ]; then
        sleep 300  # 5 minute delay
    fi
done
```

## Example 8: Building Only Specific Apps

```bash
# 1. Build only web apps
cd containers
make web-base REGISTRY=registry.example.com TAG=1.0.0
make jupyterlab REGISTRY=registry.example.com TAG=1.0.0
make pgweb REGISTRY=registry.example.com TAG=1.0.0

# 2. Build only browser apps
make firefox REGISTRY=registry.example.com TAG=1.0.0
make vivaldi REGISTRY=registry.example.com TAG=1.0.0

# 3. Push specific apps
docker push registry.example.com/lwp/firefox:1.0.0
docker push registry.example.com/lwp/jupyterlab:1.0.0
```

## Example 9: Checking Deployment Health

```bash
# 1. Quick health check
kubectl get pods -n lwp | grep -v Running && echo "✓ All pods healthy" || echo "✗ Pod issues"

# 2. Detailed verification
./skills/release-workflow/scripts/verify.sh

# 3. Check specific metrics
kubectl top pods -n lwp
kubectl get events -n lwp --sort-by='.metadata.creationTimestamp'

# 4. Check session creation
kubectl logs -n lwp deploy/backend | grep -i "session created"

# 5. Check authentication
kubectl logs -n lwp deploy/backend | grep -i "auth success"
```

## Example 10: Troubleshooting Common Issues

### Issue: Image push failures
```bash
# Check Docker login
docker login registry.example.com

# Verify credentials in .env
cat compose/.env | grep REGISTRY

# Check if images exist locally
docker images | grep lwp

# Retry push with verbose output
docker push registry.example.com/lwp/backend:1.0.0 --verbose
```

### Issue: Deployment stuck
```bash
# Check pod status
kubectl describe pods -n lwp

# Check logs
kubectl logs -n lwp deploy/backend
kubectl logs -n lwp deploy/frontend

# Check events
kubectl get events -n lwp --sort-by='.metadata.creationTimestamp'

# Check rollout status
kubectl rollout status deployment/backend -n lwp --timeout=5m
```

### Issue: Migration errors
```bash
# Check current migration
kubectl exec -n lwp deploy/backend -- alembic current

# Check migration history
kubectl exec -n lwp deploy/backend -- alembic history

# Run specific migration
kubectl exec -n lwp deploy/backend -- alembic upgrade head

# Check database connection
kubectl exec -n lwp deploy/backend -- python -c "from app.database import get_session; print('DB OK')"
```

## Tips and Best Practices

1. **Always test in staging first** before deploying to production
2. **Use dry run** to review commands before execution
3. **Check logs** after deployment to verify everything is working
4. **Monitor metrics** using Prometheus after deployment
5. **Communicate** with the team before and after deployment
6. **Keep old images** available for rollback
7. **Document changes** in release notes and changelog
8. **Tag releases** in git for traceability
9. **Use semantic versioning** consistently
10. **Automate verification** to catch issues early

## Further Reading

- See `SKILL.md` for complete documentation
- See `README.md` for quick reference
- See `tests/test_release_workflow.py` for usage examples
- See `scripts/release.sh --help` for command line options
