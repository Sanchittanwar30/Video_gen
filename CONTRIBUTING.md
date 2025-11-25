# Contributing to Video Generation Studio

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## 📋 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Help maintain a positive environment

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.x
- Python 3.9+ (for pen sketch features)
- Git
- Basic knowledge of React, TypeScript, and Node.js

### Setup Development Environment

1. **Fork and clone**
```bash
git clone https://github.com/YOUR_USERNAME/video-generation-studio.git
cd video-generation-studio
```

2. **Install dependencies**
```bash
npm install
cd frontend && npm install && cd ..
cd remotion && npm install && cd ..
pip install -r requirements-pen-sketch.txt
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your API keys
```

4. **Run development servers**
```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

## 🔄 Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### Branch Naming Convention:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/updates
- `chore/` - Maintenance tasks

### 2. Make Your Changes

- Write clean, readable code
- Follow existing code style
- Add comments for complex logic
- Update documentation if needed

### 3. Test Your Changes

```bash
# Run linter
npm run lint

# Run type checking
npm run type-check

# Test the application manually
npm run dev
```

### 4. Commit Your Changes

We use **Conventional Commits**:

```bash
# Format: <type>(<scope>): <description>

# Examples:
git commit -m "feat(ui): add confetti animation on video completion"
git commit -m "fix(api): resolve video playback CORS issue"
git commit -m "docs(readme): update setup instructions"
git commit -m "refactor(components): simplify progress logic"
```

**Commit Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Adding/updating tests
- `chore` - Maintenance tasks

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- **Clear title** describing the change
- **Description** explaining what and why
- **Screenshots/videos** for UI changes
- **Related issues** (if applicable)

## 📝 Code Style Guidelines

### TypeScript/JavaScript

```typescript
// ✅ Good
interface VideoConfig {
  duration: number;
  frameRate: number;
  width: number;
  height: number;
}

async function generateVideo(config: VideoConfig): Promise<string> {
  // Implementation
}

// ❌ Bad
function generateVideo(duration, frameRate, width, height) {
  // No types, unclear parameters
}
```

### React Components

```tsx
// ✅ Good - Functional component with TypeScript
interface VideoPlayerProps {
  videoUrl: string;
  autoPlay?: boolean;
  onComplete?: () => void;
}

export default function VideoPlayer({ 
  videoUrl, 
  autoPlay = false,
  onComplete 
}: VideoPlayerProps) {
  // Component logic
}

// ❌ Bad - No types, unclear props
export default function VideoPlayer(props) {
  // Component logic
}
```

### File Naming

- **Components**: `PascalCase.tsx` (e.g., `VideoPlayer.tsx`)
- **Utilities**: `camelCase.ts` (e.g., `generateId.ts`)
- **Styles**: `ComponentName.css` (e.g., `VideoPlayer.css`)
- **Tests**: `ComponentName.test.tsx`

### CSS

```css
/* ✅ Good - Use CSS variables */
.button {
  background: var(--color-primary);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
}

/* ❌ Bad - Hardcoded values */
.button {
  background: #667eea;
  padding: 16px;
  border-radius: 8px;
}
```

## 🧪 Testing Guidelines

### Manual Testing Checklist

Before submitting:
- [ ] Test on Chrome, Firefox, Safari
- [ ] Test responsive design (mobile, tablet, desktop)
- [ ] Test all new features thoroughly
- [ ] Check console for errors
- [ ] Verify no broken links or images
- [ ] Test error handling

### Adding Tests (Future)

```typescript
// Example test structure
describe('VideoPlayer', () => {
  it('should play video when play button is clicked', () => {
    // Test implementation
  });

  it('should pause other videos when playing', () => {
    // Test implementation
  });
});
```

## 🐛 Bug Reports

When reporting bugs, include:

1. **Clear title** describing the issue
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Screenshots/videos** if applicable
6. **Environment**:
   - OS (Windows/Mac/Linux)
   - Browser and version
   - Node.js version
   - Python version (if relevant)
7. **Console errors** (if any)

**Template:**
```markdown
### Bug Description
Clear description of the bug

### Steps to Reproduce
1. Go to...
2. Click on...
3. See error...

### Expected Behavior
What should happen

### Actual Behavior
What actually happens

### Environment
- OS: Windows 11
- Browser: Chrome 120
- Node.js: v18.17.0

### Screenshots
[Add screenshots here]

### Console Errors
```
[Paste console errors here]
```
```

## ✨ Feature Requests

When suggesting features:

1. **Clear use case** - Why is this needed?
2. **Proposed solution** - How should it work?
3. **Alternatives** - Other ways to achieve this?
4. **Additional context** - Screenshots, examples, etc.

## 📚 Documentation

### When to Update Docs

- Adding new features
- Changing existing behavior
- Adding new configuration options
- Fixing documentation errors
- Adding examples

### Documentation Structure

- **README.md** - Project overview and quick start
- **API docs** - Endpoint documentation
- **Component docs** - React component usage
- **Setup guides** - Installation and configuration
- **Troubleshooting** - Common issues and solutions

## 🔍 Code Review Process

### For Reviewers

- Be constructive and respectful
- Explain why changes are needed
- Suggest alternatives
- Approve when ready

### For Contributors

- Respond to feedback promptly
- Ask questions if unclear
- Make requested changes
- Be open to suggestions

## 🎨 UI/UX Contributions

### Design Guidelines

- **Consistency** - Follow existing patterns
- **Accessibility** - WCAG 2.1 AA compliance
- **Responsiveness** - Mobile-first approach
- **Performance** - Optimize images and animations
- **User feedback** - Loading states, errors, success

### Animation Guidelines

- **Subtle** - Don't overdo it
- **Purposeful** - Animations should serve a purpose
- **Performant** - Use CSS transforms and opacity
- **Duration** - 200-400ms for UI interactions
- **Easing** - Use `ease-out` for most animations

## 🌐 Internationalization (Future)

Preparing for i18n:

```typescript
// ✅ Good - Externalized strings
<button>{t('generate.button.submit')}</button>

// ❌ Bad - Hardcoded strings
<button>Generate Video</button>
```

## 📦 Package Management

### Adding Dependencies

Before adding a new dependency:
1. Check if existing dependencies can solve the problem
2. Evaluate package size and bundle impact
3. Check maintenance status and community support
4. Document why it's needed in PR

```bash
# Add to package.json
npm install package-name

# Commit lockfile
git add package-lock.json
git commit -m "chore: add package-name dependency"
```

## 🚀 Release Process

### Version Numbering

We follow **Semantic Versioning** (semver):

- `MAJOR.MINOR.PATCH`
- **MAJOR** - Breaking changes
- **MINOR** - New features (backwards compatible)
- **PATCH** - Bug fixes

### Changelog

Update `CHANGELOG.md` with:
- Added features
- Fixed bugs
- Changed behavior
- Deprecated features
- Removed features

## ❓ Questions?

- **Documentation**: Check [README.md](README.md) and docs/
- **Discussions**: Use GitHub Discussions for questions
- **Issues**: Search existing issues before creating new ones

## 🙏 Thank You!

Every contribution matters! Thank you for helping make Video Generation Studio better. 🎉

---

**Happy Coding!** 💻✨

