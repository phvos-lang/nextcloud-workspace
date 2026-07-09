# Release Workflow Skill Index

Welcome to the Release Workflow Skill for Nextcloud Linux Workspace (LWP).

## Quick Navigation

### Getting Started
- **[QUICKSTART.md](QUICKSTART.md)** - 5-minute setup guide
- **[README.md](README.md)** - Overview and features
- **[SKILL.md](SKILL.md)** - Complete documentation

### Usage
- **[EXAMPLES.md](EXAMPLES.md)** - Practical usage examples
- **[DEMO.md](DEMO.md)** - Step-by-step walkthrough
- **[scripts/release.sh](scripts/release.sh)** - Automated release script
- **[scripts/verify.sh](scripts/verify.sh)** - Deployment verification

### Reference
- **[templates/CHANGELOG.md](templates/CHANGELOG.md)** - Changelog template
- **[SUMMARY.md](SUMMARY.md)** - Skill overview
- **[tests/test_release_workflow.py](tests/test_release_workflow.py)** - Test suite

## File Structure

```
skills/release-workflow/
├── QUICKSTART.md          # 🚀 Quick start guide
├── README.md              # 📋 Overview
├── SKILL.md               # 📖 Complete documentation
├── EXAMPLES.md            # 💡 Usage examples
├── DEMO.md                # 🎬 Step-by-step demo
├── INDEX.md               # 📑 This index
├── SUMMARY.md             # 📊 Skill summary
├── scripts/
│   ├── release.sh         # 🔧 Automated release
│   └── verify.sh          # ✅ Deployment verification
├── templates/
│   └── CHANGELOG.md       # 📝 Changelog template
└── tests/
    └── test_release_workflow.py  # 🧪 Test suite
```

## Recommended Reading Order

1. **Start here**: [QUICKSTART.md](QUICKSTART.md) - Get up and running quickly
2. **Understand**: [README.md](README.md) - Learn what the skill does
3. **Deep dive**: [SKILL.md](SKILL.md) - Complete process documentation
4. **See it in action**: [DEMO.md](DEMO.md) - Step-by-step walkthrough
5. **Practical examples**: [EXAMPLES.md](EXAMPLES.md) - Real-world scenarios

## Key Features

✅ **Automated Release Process** - Build, push, deploy, verify
✅ **Dry Run Mode** - Test before executing
✅ **Deployment Verification** - Comprehensive health checks
✅ **Comprehensive Documentation** - Multiple formats and examples
✅ **Test Suite** - Validates functionality
✅ **Templates** - Ready-to-use changelog format

## Quick Commands

```bash
# Test release (dry run)
./scripts/release.sh --version 1.0.0 --dry-run

# Execute release
./scripts/release.sh --version 1.0.0

# Verify deployment
./scripts/verify.sh

# Run tests
python3 tests/test_release_workflow.py
```

## When to Use This Skill

Use this skill when you need to:
- **Prepare a release** - Determine version and prepare artifacts
- **Build images** - Create container images for deployment
- **Push to registry** - Upload images to container registry
- **Deploy to Kubernetes** - Update and apply Kubernetes manifests
- **Run migrations** - Apply database schema changes
- **Verify deployment** - Check health and readiness
- **Create release notes** - Document changes for users
- **Tag releases** - Create git tags for version tracking

## Skill Capabilities

### Automation
- ✅ Image building (platform + apps)
- ✅ Image pushing to registry
- ✅ Kubernetes manifest updates
- ✅ Deployment execution
- ✅ Database migrations
- ✅ Health verification

### Documentation
- ✅ Step-by-step instructions
- ✅ Best practices guide
- ✅ Troubleshooting information
- ✅ Usage examples
- ✅ Demo walkthrough

### Testing
- ✅ Automated test suite
- ✅ Syntax validation
- ✅ Functionality verification
- ✅ Dry run testing

## Support Resources

### Documentation
- [QUICKSTART.md](QUICKSTART.md) - Fast setup
- [README.md](README.md) - Feature overview
- [SKILL.md](SKILL.md) - Complete guide
- [EXAMPLES.md](EXAMPLES.md) - Usage scenarios
- [DEMO.md](DEMO.md) - Walkthrough

### Tools
- [scripts/release.sh](scripts/release.sh) - Release automation
- [scripts/verify.sh](scripts/verify.sh) - Health checks
- [templates/CHANGELOG.md](templates/CHANGELOG.md) - Template
- [tests/test_release_workflow.py](tests/test_release_workflow.py) - Tests

### Reference
- [SUMMARY.md](SUMMARY.md) - Skill overview
- [INDEX.md](INDEX.md) - Navigation guide

## Version Bump Guide

| Type | Example | When to Use |
|------|---------|-------------|
| **PATCH** | 1.0.0 → 1.0.1 | Bug fixes, security patches |
| **MINOR** | 1.0.0 → 1.1.0 | New features, backward compatible |
| **MAJOR** | 1.0.0 → 2.0.0 | Breaking changes, incompatible API |

## Common Workflows

### Simple Patch Release
```bash
# 1. Test
./scripts/release.sh --version 1.0.1 --dry-run

# 2. Execute
./scripts/release.sh --version 1.0.1

# 3. Verify
./scripts/verify.sh
```

### Feature Release
```bash
# 1. Test in staging
./scripts/release.sh --version 1.1.0 --dry-run

# 2. Execute in staging
./scripts/release.sh --version 1.1.0

# 3. Test thoroughly
./scripts/verify.sh

# 4. Deploy to production
./scripts/release.sh --version 1.1.0
```

### Emergency Security Release
```bash
# 1. Quick test
./scripts/release.sh --version 1.0.2 --dry-run

# 2. Immediate deployment
./scripts/release.sh --version 1.0.2

# 3. Verify immediately
./scripts/verify.sh
```

## Need More Information?

- **For quick setup**: [QUICKSTART.md](QUICKSTART.md)
- **For complete process**: [SKILL.md](SKILL.md)
- **For examples**: [EXAMPLES.md](EXAMPLES.md)
- **For walkthrough**: [DEMO.md](DEMO.md)
- **For overview**: [SUMMARY.md](SUMMARY.md)

## Skill Status

🟢 **Production Ready** - All tests passing, fully documented, ready for use

```
Test Results:
✓ File existence validation
✓ Script executability checks
✓ Syntax validation
✓ Help output verification
✓ Dry run functionality
✓ Documentation completeness
```

## Next Steps

1. **Read**: [QUICKSTART.md](QUICKSTART.md) to get started
2. **Test**: Run `./scripts/release.sh --version 1.0.0 --dry-run`
3. **Execute**: Run `./scripts/release.sh --version 1.0.0`
4. **Verify**: Run `./scripts/verify.sh`
5. **Document**: Update changelog and create release notes

## Feedback

This skill is designed to make LWP releases efficient and reliable. If you encounter any issues or have suggestions for improvement, please review the documentation and test suite to ensure proper usage.

For feature requests or bug reports, check the existing documentation first as the solution may already be covered.
