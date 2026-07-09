# Release Workflow Skill

This skill automates the release process for Nextcloud Linux Workspace (LWP).

## Features

- **Automated version management**: Handles semantic versioning and image tagging
- **Container image building**: Builds all platform and app images
- **Registry integration**: Pushes images to container registry
- **Kubernetes deployment**: Updates manifests and applies deployments
- **Migration management**: Runs database migrations after deployment
- **Verification**: Checks deployment health and service status

## Usage

### Manual Release Process

Follow the steps in `SKILL.md` for a manual release:

1. Determine version bump type
2. Update version in Kubernetes manifests
3. Build platform images (backend + frontend)
4. Build container images (base + apps)
5. Push all images to registry
6. Deploy to Kubernetes
7. Run database migrations
8. Register app images in admin panel
9. Verify deployment

### Automated Release Script

Use the release script for automated releases:

```bash
# Dry run (show commands without executing)
./skills/release-workflow/scripts/release.sh --version 1.0.0 --dry-run

# Actual release
./skills/release-workflow/scripts/release.sh --version 1.0.0
```

## Configuration

Edit the release script to configure:

- `REGISTRY`: Your container registry URL
- `PROJECT_DIR`: Path to LWP project directory
- `K8S_DIR`: Path to Kubernetes overlay directory

## Version Bump Guide

- **MAJOR**: Breaking changes, incompatible API changes
- **MINOR**: Backward-compatible new features  
- **PATCH**: Backward-compatible bug fixes

## Best Practices

1. **Test before production**: Always test in staging first
2. **Rollback plan**: Keep previous version images available
3. **Blue-green deployment**: Use Kubernetes rolling updates
4. **Monitor**: Check Prometheus metrics after deployment
5. **Communicate**: Notify team before and after deployment

## Troubleshooting

See `SKILL.md` for common issues and solutions.

## File Structure

```
skills/release-workflow/
├── SKILL.md              # Main skill documentation
├── README.md             # This file
├── scripts/
│   ├── release.sh        # Automated release script
│   └── verify.sh         # Deployment verification script
└── templates/
    └── changelog.md      # Changelog template
```

## When to Use This Skill

Use this skill when:
- Preparing a new release
- Cutting a version tag
- Deploying to production
- Updating container images
- Running database migrations
- Verifying deployment health

The skill handles all aspects of the release process from version management to deployment verification.
