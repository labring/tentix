# GitHub Actions Workflows

This directory contains GitHub Actions workflows for different scenarios in the development lifecycle.

## Workflow Overview

### 1. `fork-check.yml` - Fork Repository Safety Check
**Trigger:** `pull_request_target` from fork repositories
**Purpose:** Basic security and build checks for contributions from fork repositories

- ✅ Security scan for suspicious code patterns
- ✅ Dependency change detection
- ✅ Basic linting and build test
- ✅ Automated PR comment with results
- 🔒 **No access to secrets** - Safe for untrusted code

### 2. `build.yml` - Build Check
**Trigger:** 
- `pull_request` to main/develop branches (from main repo)
- `push` to any branch except main

**Purpose:** Comprehensive build and test checks for trusted contributions

- ✅ Linting and type checking
- ✅ Test execution
- ✅ Application build
- ✅ Docker image build (PR only)
- ✅ Security audit

### 3. `docker-publish.yml` - Build & Deploy
**Trigger:**
- `push` to main branch
- `pull_request` closed (merged) to main branch

**Purpose:** Production deployment pipeline

- ✅ Full test suite
- ✅ Application build
- ✅ Docker image build and push to multiple registries
- ✅ Version tagging
- 🚀 **Production deployment**

### 4. `approved-fork.yml` - Approved Fork PR Test
**Trigger:** Manual (`workflow_dispatch`)
**Purpose:** Full testing for fork PRs after maintainer approval

- ✅ Complete test suite
- ✅ Docker image build and push
- ✅ PR status update
- 🔧 **Manual trigger by maintainers**

## Workflow Decision Tree

```
┌─ Fork Repository PR ────────────────────────────────────┐
│  ├─ fork-check.yml (automatic)                          │
│  └─ approved-fork.yml (manual, after review)           │
└─────────────────────────────────────────────────────────┘

┌─ Main Repository PR ────────────────────────────────────┐
│  └─ build.yml (automatic)                               │
└─────────────────────────────────────────────────────────┘

┌─ Main Branch Push/Merge ────────────────────────────────┐
│  └─ docker-publish.yml (automatic)                      │
└─────────────────────────────────────────────────────────┘
```

## Security Considerations

1. **Fork PRs**: Use `pull_request_target` with limited permissions
2. **Secrets**: Only available to main repository workflows
3. **Manual Approval**: Fork PRs require maintainer approval for full testing
4. **Image Registry**: Supports both GitHub Container Registry and Aliyun Registry

## Configuration

### Required Secrets (Optional for Aliyun Registry)
- `DOCKER_REGISTRY`: Aliyun registry URL
- `DOCKER_USERNAME`: Registry username
- `DOCKER_PASSWORD`: Registry password
- `IMAGE_NAME`: Image name (defaults to 'tentix')

### GitHub Token
- Automatically provided as `GITHUB_TOKEN`
- Used for GitHub Container Registry access

## Usage

### For Maintainers

1. **Fork PR Review Process:**
   - Fork contributor creates PR → `fork-check.yml` runs automatically
   - Review the PR and the safety check results
   - If approved, manually trigger `approved-fork.yml` with PR number
   - Merge if all tests pass

2. **Main Repository Development:**
   - Create PR → `build.yml` runs automatically
   - Merge to main → `docker-publish.yml` runs automatically

### For Contributors

1. **From Fork:**
   - Create PR → Wait for safety check
   - Address any issues found
   - Wait for maintainer review and approval

2. **From Main Repository:**
   - Create PR → Full CI runs automatically
   - All checks must pass before merge 