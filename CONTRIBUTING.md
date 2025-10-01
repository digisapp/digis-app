# Contributing to Digis

Thank you for your interest in contributing to Digis! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Git
- PostgreSQL (via Supabase)
- Redis (for queues and caching)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/digisapp/digis-app.git
   cd digis-app
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   # Backend
   cp backend/.env.example backend/.env
   # Frontend
   cp frontend/.env.example frontend/.env
   ```

4. **Run database migrations**
   ```bash
   pnpm migrate
   ```

5. **Start development servers**
   ```bash
   pnpm dev
   ```

## 📋 Development Workflow

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `fix/*` - Bug fixes
- `refactor/*` - Code refactoring
- `docs/*` - Documentation updates

### Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clear, concise commit messages
   - Follow the code style guidelines
   - Add tests for new functionality
   - Update documentation as needed

3. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

4. **Push and create a PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## 📝 Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test updates
- `chore`: Build process or auxiliary tool changes
- `ci`: CI/CD changes
- `revert`: Revert a previous commit

### Examples

```
feat(auth): add JWT refresh token rotation

- Implement refresh token rotation
- Add Redis-based token invalidation
- Add reuse detection

Closes #123
```

```
fix(payments): correct Stripe webhook signature verification

The previous implementation didn't properly verify webhook signatures,
potentially allowing unauthorized requests.

Fixes #456
```

## 🧪 Testing

### Run Tests

```bash
# All tests
pnpm test

# Backend only
pnpm --filter @digis/backend test

# Frontend only
pnpm --filter @digis/frontend test

# Watch mode
pnpm test --watch
```

### Writing Tests

- Place unit tests next to the source files: `*.test.js` or `*.test.ts`
- Place integration tests in `__tests__/integration/`
- Place E2E tests in `frontend/tests/e2e/`

## 🎨 Code Style

### JavaScript/TypeScript

- Use 2 spaces for indentation
- Use double quotes for strings
- Use semicolons
- Use trailing commas in multi-line structures
- Max line length: 100 characters

### Run Linters

```bash
# Lint all code
pnpm lint

# Auto-fix issues
pnpm lint --fix

# Format code
pnpm format
```

## 📚 Documentation

- Update README.md for user-facing changes
- Update inline comments for complex logic
- Update API documentation for endpoint changes
- Add migration guides for breaking changes

## 🐛 Reporting Bugs

When reporting bugs, please include:

1. **Description**: Clear description of the bug
2. **Steps to Reproduce**: Detailed steps to reproduce the issue
3. **Expected Behavior**: What you expected to happen
4. **Actual Behavior**: What actually happened
5. **Environment**: OS, Node version, browser, etc.
6. **Screenshots**: If applicable
7. **Logs**: Relevant error messages or logs

## ✨ Suggesting Features

When suggesting features, please include:

1. **Problem**: What problem does this solve?
2. **Solution**: Describe your proposed solution
3. **Alternatives**: Alternative solutions you've considered
4. **Additional Context**: Any other relevant information

## 🔍 Code Review Process

1. **Automated Checks**: CI must pass (lint, test, build)
2. **Peer Review**: At least 1 approval required
3. **Testing**: Manual testing if applicable
4. **Documentation**: Ensure docs are updated
5. **Merge**: Squash and merge to keep history clean

## 🚨 Security

- **Never commit secrets** (.env files, API keys, etc.)
- **Report security issues privately** via email: security@digis.cc
- **Follow security best practices**:
  - Validate all user input
  - Use parameterized queries
  - Implement rate limiting
  - Keep dependencies updated

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Team Chat**: For quick questions (if you're part of the team)

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You!

Your contributions make Digis better for everyone. We appreciate your time and effort!
