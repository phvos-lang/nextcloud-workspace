#!/usr/bin/env python3
"""
Test script for release workflow skill
"""

import os
import subprocess
import sys
from pathlib import Path

def run_command(cmd, cwd=None):
    """Run a command and return the result"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=30
        )
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", "Command timed out"

def test_files_exist():
    """Test that all required files exist"""
    print("Testing file existence...")
    
    required_files = [
        "SKILL.md",
        "README.md",
        "scripts/release.sh",
        "scripts/verify.sh",
        "templates/CHANGELOG.md"
    ]
    
    base_dir = Path(__file__).parent.parent
    
    for file_path in required_files:
        full_path = base_dir / file_path
        if not full_path.exists():
            print(f"✗ Missing file: {file_path}")
            return False
        print(f"✓ Found file: {file_path}")
    
    return True

def test_scripts_executable():
    """Test that scripts are executable"""
    print("\nTesting script executability...")
    
    scripts = [
        "scripts/release.sh",
        "scripts/verify.sh"
    ]
    
    base_dir = Path(__file__).parent.parent
    
    for script in scripts:
        full_path = base_dir / script
        if not os.access(full_path, os.X_OK):
            print(f"✗ Script not executable: {script}")
            return False
        print(f"✓ Script executable: {script}")
    
    return True

def test_syntax():
    """Test script syntax"""
    print("\nTesting script syntax...")
    
    scripts = [
        "scripts/release.sh",
        "scripts/verify.sh"
    ]
    
    base_dir = Path(__file__).parent.parent
    
    for script in scripts:
        full_path = base_dir / script
        success, stdout, stderr = run_command(f"bash -n {full_path}")
        if not success:
            print(f"✗ Syntax error in {script}:")
            print(stderr)
            return False
        print(f"✓ Syntax valid: {script}")
    
    return True

def test_help_output():
    """Test that release script has help output"""
    print("\nTesting help output...")
    
    base_dir = Path(__file__).parent.parent
    script_path = base_dir / "scripts/release.sh"
    
    success, stdout, stderr = run_command(f"{script_path} --help")
    if not success:
        print(f"✗ Help command failed: {stderr}")
        return False
    
    if "Usage:" not in stdout:
        print("✗ Help output missing Usage section")
        return False
    
    print("✓ Help output working")
    return True

def test_dry_run():
    """Test dry run mode"""
    print("\nTesting dry run mode...")
    
    base_dir = Path(__file__).parent.parent.parent.parent  # Go to project root
    script_path = base_dir / "skills/release-workflow/scripts/release.sh"
    
    success, stdout, stderr = run_command(
        f"{script_path} --version 1.0.0 --dry-run",
        cwd=base_dir
    )
    
    if not success:
        print(f"✗ Dry run failed: {stderr}")
        return False
    
    if "[DRY RUN]" not in stdout:
        print("✗ Dry run not working - commands should be prefixed with [DRY RUN]")
        return False
    
    print("✓ Dry run working")
    return True

def test_documentation():
    """Test documentation completeness"""
    print("\nTesting documentation...")
    
    base_dir = Path(__file__).parent.parent
    
    # Check SKILL.md
    skill_file = base_dir / "SKILL.md"
    skill_content = skill_file.read_text()
    
    required_sections = [
        "## Description",
        "## Compatibility",
        "## Release Process Overview",
        "## Detailed Workflow",
        "## Release Checklist",
        "## Common Commands"
    ]
    
    for section in required_sections:
        if section not in skill_content:
            print(f"✗ Missing section in SKILL.md: {section}")
            return False
        print(f"✓ Found section: {section}")
    
    return True

def main():
    """Run all tests"""
    print("=" * 60)
    print("LWP Release Workflow Skill Tests")
    print("=" * 60)
    
    tests = [
        test_files_exist,
        test_scripts_executable,
        test_syntax,
        test_help_output,
        test_dry_run,
        test_documentation
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"✗ Test failed with exception: {e}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)
    
    if failed > 0:
        sys.exit(1)
    else:
        print("\n✓ All tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()
