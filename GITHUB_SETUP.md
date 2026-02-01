# 🚀 GitHub Repository Setup Guide

Follow these steps to create your backend repository on GitHub.

## 📝 Step 1: Create Repository on GitHub

1. Go to [GitHub](https://github.com) and log in
2. Click the **"+"** icon in the top-right corner
3. Select **"New repository"**
4. Fill in the details:
   - **Repository name**: `sports-courts-backend` (or your preferred name)
   - **Description**: "Backend API for a SaaS platform managing sports court rentals"
   - **Visibility**: Choose Public or Private
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click **"Create repository"**

## 💻 Step 2: Initialize Local Repository

Open your terminal and navigate to the directory containing these files:

```bash
# Navigate to the project directory
cd /path/to/sports-courts-backend

# Initialize git repository
git init

# Add all files to staging
git add .

# Create initial commit
git commit -m "Initial commit: Project structure and documentation"
```

## 🔗 Step 3: Connect to GitHub

Replace `YOUR_USERNAME` with your actual GitHub username:

```bash
# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/sports-courts-backend.git

# Verify remote was added
git remote -v

# Push to GitHub
git branch -M main
git push -u origin main
```

## ✅ Step 4: Verify on GitHub

1. Refresh your repository page on GitHub
2. You should see all your files uploaded
3. The README.md will be displayed on the main page

## 🔐 Step 5: Set Up Repository Settings (Optional but Recommended)

### Enable Branch Protection

1. Go to **Settings** → **Branches**
2. Add rule for `main` branch:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require conversation resolution before merging

### Add Topics

1. Go to **Settings** → About (top of repository page)
2. Click the gear icon
3. Add topics: `saas`, `sports`, `booking-system`, `api`, `backend`, `multi-tenant`

### Create Issues Templates (Optional)

```bash
# Create .github directory
mkdir -p .github/ISSUE_TEMPLATE

# Add issue templates for bugs and features
# (Templates can be created via GitHub UI or locally)
```

## 📋 Step 6: Next Steps

### Set Up Development Environment

1. Choose your tech stack (Node.js, Python, Go, etc.)
2. Install dependencies
3. Set up database
4. Configure environment variables

### Create First Feature Branch

```bash
# Create and switch to new branch
git checkout -b feature/initial-setup

# Make your changes
# ...

# Commit changes
git add .
git commit -m "feat: initial project setup with [your tech stack]"

# Push to GitHub
git push -u origin feature/initial-setup

# Create Pull Request on GitHub
```

## 🛠️ Recommended GitHub Actions (CI/CD)

Create `.github/workflows/ci.yml` for automated testing:

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up [Your Runtime]
      # Add setup steps for your chosen tech stack
    
    - name: Install dependencies
      # Add installation command
    
    - name: Run linter
      # Add linting command
    
    - name: Run tests
      # Add test command
    
    - name: Check coverage
      # Add coverage command
```

## 📚 Additional Resources

- [GitHub Docs](https://docs.github.com)
- [Git Basics](https://git-scm.com/book/en/v2/Getting-Started-Git-Basics)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Conventional Commits](https://www.conventionalcommits.org/)

## 🤝 Collaboration

### Invite Collaborators

1. Go to **Settings** → **Collaborators**
2. Click **"Add people"**
3. Enter GitHub username or email
4. Select permission level (Write, Maintain, Admin)

### Set Up Team

If you have a GitHub Organization:
1. Create a team
2. Add team members
3. Give team access to repository

## 🔒 Security

### Add Secrets

For CI/CD and deployments:
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add secrets (database credentials, API keys, etc.)
3. Reference in workflows: `${{ secrets.SECRET_NAME }}`

### Enable Security Features

- ✅ Dependabot alerts
- ✅ Code scanning alerts
- ✅ Secret scanning

## 🎉 You're All Set!

Your backend repository is now ready for development. Happy coding!

---

**Need Help?**
- Check the [CONTRIBUTING.md](CONTRIBUTING.md) guide
- Review the [documentation](docs/)
- Open an issue for questions
