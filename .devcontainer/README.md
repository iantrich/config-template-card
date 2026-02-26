# Home Assistant Custom Card - Dev Container Setup

This directory contains the development container configuration for building and testing the config-template-card custom card for Home Assistant.

## Setup Instructions

1. **Install VS Code Remote Containers**
   - [VS Code Extension: Remote - Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

2. **Open in Dev Container**
   - Open the project folder in VS Code
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Remote-Containers: Reopen in Container"
   - Wait for the container to build (first time takes ~2-3 minutes)

3. **Build the Card**
   ```bash
   yarn build      # Lint and build
   yarn start      # Start dev server with hot reload (port 5000)
   yarn lint       # Check code quality
   yarn rollup     # Production build
   ```

4. **Access Services**
   - **Dev Container**: Terminal in VS Code (automatic)
   - **Home Assistant**: http://localhost:8123 (user: dev/pass: dev)
   - **Rollup Dev Server**: http://localhost:5000

5. **Configure Home Assistant to Use Your Card**
   - In Home Assistant, go to Settings > Dashboards
   - Create a new Dashboard
   - Add the card from the GUI

## File Structure

```
.devcontainer/
├── Dockerfile           # Docker image definition
├── devcontainer.json    # VS Code dev container config
├── .gitignore          # Ignore HA data
└── README.md           # This file
```

## Development Workflow

### Building the Card

```bash
# One-time setup (automatic on container creation)
yarn install

# Development with hot reload
yarn start              # Runs Rollup in watch mode on port 5000

# Quality checks
yarn lint             # ESLint check
yarn build            # Full build pipeline (lint + rollup)

# Production build
yarn rollup           # Create optimized dist files
```

### File Locations

- **Source Code**: `src/`
- **Built Output**: `dist/` (inside container)
- **Configuration**: Root directory (`tsconfig.json`, `rollup.config.js`, etc.)

## Troubleshooting

### Container Won't Start
```bash
# Rebuild the container
ctrl+shift+p → "Remote: Rebuild Container"
```

### Port Already in Use
```bash
# Find what's using port 5000 or 8123
lsof -i :5000
lsof -i :8123
```

### Node Modules Issues
```bash
# Clear and reinstall dependencies
rm -rf node_modules
yarn install
```

## Additional Resources

- [Home Assistant Custom Card Development](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/)
- [VS Code Dev Containers Docs](https://code.visualstudio.com/docs/remote/containers)
- [Lit Documentation](https://lit.dev/)
- [Material Design Web Components](https://github.com/material-components/material-web)

## Environment Details

- **Node.js**: 24
- **TypeScript**: 5.9.3
- **Build Tool**: Rollup 4.20
- **Linter**: ESLint 9 + TypeScript Support
- **Code Formatter**: Prettier 3.8
- **Web Framework**: Lit 3.2
- **Home Assistant Image**: Latest (optional)

## Notes

- The container runs as non-root user `nodejs` for security
- Volume mounts use `cached` consistency mode for better performance on Mac/Windows
- All Yarn commands run inside the container automatically
- VS Code extensions are configured for TypeScript and YAML development
