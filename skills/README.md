# LWP Skills

This directory contains reusable skills and automation workflows for Nextcloud Linux Workspace (LWP).

## Available Skills

### Release Workflow

**Purpose**: Automates the release process for LWP

**Features**:
- Version management and semantic versioning
- Container image building and pushing
- Kubernetes deployment updates
- Database migration management
- Deployment verification

**Usage**:
```bash
# Manual release (follow SKILL.md)
cd skills/release-workflow

# Automated release
./scripts/release.sh --version 1.0.0

# Dry run
./scripts/release.sh --version 1.0.0 --dry-run

# Verify deployment
./scripts/verify.sh
```

**Files**:
- `SKILL.md` - Comprehensive release documentation
- `README.md` - Quick reference
- `scripts/release.sh` - Automated release script
- `scripts/verify.sh` - Deployment verification
- `templates/CHANGELOG.md` - Changelog template

## Creating New Skills

To create a new skill:

1. Create a new directory: `skills/{skill-name}/`
2. Add `SKILL.md` with skill documentation
3. Add any required scripts in `scripts/`
4. Add templates in `templates/` if needed
5. Add tests in `tests/`
6. Document usage in `README.md`

## Skill Structure

```
skills/
├── {skill-name}/
│   ├── SKILL.md              # Main skill documentation
│   ├── README.md             # Quick reference
│   ├── scripts/
│   │   └── {script}.sh       # Automation scripts
│   ├── templates/
│   │   └── {template}.md     # File templates
│   └── tests/
│       └── test_{skill}.py  # Test scripts
└── README.md                 # This file
```

## Best Practices

1. **Documentation**: Every skill must have comprehensive `SKILL.md`
2. **Automation**: Provide scripts for common tasks
3. **Testing**: Include tests to validate skill functionality
4. **Templates**: Provide templates for common outputs
5. **Versioning**: Document version compatibility

## When to Use Skills

Skills are designed to handle:
- Complex, multi-step workflows
- Tasks that require specific knowledge
- Processes that benefit from automation
- Best practices and standards

Use skills when you need:
- Consistent execution of processes
- Documentation of complex workflows
- Automation of repetitive tasks
- Validation of results

## Contributing

When adding new skills:
1. Follow the skill structure above
2. Include comprehensive documentation
3. Add automation scripts where possible
4. Write tests to validate functionality
5. Document usage examples

## Skill Development Workflow

1. **Research**: Understand the problem and requirements
2. **Design**: Create the skill structure and documentation
3. **Implement**: Write scripts and templates
4. **Test**: Validate functionality with tests
5. **Document**: Write comprehensive usage guides
6. **Review**: Get feedback and refine

## Support

For issues with skills, check:
- `SKILL.md` for detailed documentation
- `README.md` for quick reference
- `tests/` for usage examples
- Script help output: `./scripts/{script}.sh --help`
