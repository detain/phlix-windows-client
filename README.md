# Phlex Windows Desktop App

A native Windows desktop application for the Phlex Media Server, built with Electron, React, and TypeScript.

## Project Overview

Phlex Windows provides a full-featured media server client for Windows, enabling users to browse, stream, and manage their media library with native desktop integration including system tray, media keys, and native menus.

## Features

- **Media Library Browser** - Browse and search your media collection with grid views
- **Video Player** - Full-featured video playback with controls
- **System Tray Integration** - Minimize to tray with media controls
- **Native Menus** - Full application menu with keyboard shortcuts
- **Media Key Support** - Play/Pause, Stop, Rewind, Forward via system tray
- **Authentication** - Secure login with session persistence
- **Responsive UI** - Modern React-based interface with sidebar navigation
- **Settings Management** - Configurable preferences including minimize-to-tray behavior
- **Hub Mode** - Connect to a Phlex Hub to manage multiple servers, with support for direct-LAN and relay connection modes

## Prerequisites

Before setting up the project, ensure you have the following installed:

- **Node.js** v18.x or later (LTS recommended)
- **npm** v9.x or later (comes with Node.js)
- **Git** for version control
- **Windows 10/11** as the target platform

For development:
- **Visual Studio Code** (recommended) with extensions:
  - ESLint
  - Prettier
  - TypeScript and related tools

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/phlex/phlex-windows.git
   cd phlex-windows
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment** (optional)

   Create a `.env` file in the root directory if you need custom API settings:
   ```
   VITE_API_URL=http://localhost:8080
   ```

## Configuration

The application stores configuration in the user's app data directory:
- **Windows**: `%APPDATA%\phlex-windows`

### Configuration Options

| Setting | Default | Description |
|---------|---------|-------------|
| `minimizeToTray` | `true` | Minimize to system tray instead of closing |
| `apiUrl` | Auto-detected | Media server API URL |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8080` | Media server API endpoint |
| `VITE_PHLEX_HUB_URL` | (none) | Phlex Hub URL for hub-mode |
| `NODE_ENV` | `development` | Runtime environment |

## Building the App

### Development Mode

Run the application in development mode with hot reload:

```bash
npm run dev
```

This starts:
- Vite dev server on `http://localhost:5173`
- Electron app with automatic reload on changes

### Production Build

**Build both renderer and main process:**
```bash
npm run build
```

**Build only the renderer (React app):**
```bash
npm run build:vite
```

**Build only the main process (Electron):**
```bash
npm run build:electron
```

### Packaging

Package the app for Windows distribution:

**NSIS Installer (recommended):**
```bash
npm run package
```

**Windows Store (APPX):**
```bash
npm run package:store
```

The packaged output will be in the `release/` directory.

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Test Structure

- Unit tests located in `tests/unit/`
- Test files use Vitest with TypeScript
- Tests for API client, stores, and utilities

### Linting

```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

## Project Structure

```
phlex-windows/
├── src/
│   ├── main/           # Electron main process
│   │   └── index.ts    # Main entry point, window management, IPC, tray
│   ├── preload/        # Preload scripts (context bridge)
│   │   └── index.ts   # Secure IPC exposure to renderer
│   ├── hub/            # Hub service and types
│   │   └── HubService.ts
│   ├── api/            # API clients
│   │   └── hubAwareClient.ts
│   └── renderer/       # React application
│       ├── components/    # Reusable UI components (including HubSettings)
│       ├── pages/         # Page-level components
│       ├── stores/        # Zustand state stores (including hubStore)
│       ├── utils/         # Utility functions and API client
│       ├── styles/        # CSS styles
│       ├── App.tsx        # Root component
│       └── main.tsx       # Renderer entry point
├── tests/
│   └── unit/           # Unit tests (including hub/)
├── build/              # Build resources (icons)
├── release/            # Packaged application output
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Architecture

### Electron Process Model

1. **Main Process** (`src/main/index.ts`)
   - Creates BrowserWindow
   - Manages system tray and menus
   - Handles IPC from renderer
   - Manages app lifecycle

2. **Preload Script** (`src/preload/index.ts`)
   - Exposes safe APIs via contextBridge
   - Provides IPC invoke/send methods
   - Handles media control events

3. **Renderer Process** (`src/renderer/`)
   - React 18 application
   - Zustand for state management
   - React Router for navigation
   - Vite for development and bundling

### State Management

State is managed using Zustand with three main stores:

- **authStore** - Authentication state and user session
- **playbackStore** - Media playback state
- **uiStore** - UI state (sidebar, modals, etc.)

## Deployment

### GitHub Actions CI/CD

The project uses GitHub Actions for continuous integration:

- **test.yml** - Runs on every push/PR to validate code
- **build.yml** - Creates releases on tags and publishes packages

### Release Process

1. Update version in `package.json`
2. Create git tag:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```
3. GitHub Actions will automatically:
   - Run tests
   - Build the application
   - Create GitHub Release
   - Upload artifacts

### Windows Installer

The build workflow produces:
- **NSIS Installer** - Traditional `.exe` installer
- **APPX Package** - For Windows Store distribution

## Hub Mode

Hub Mode allows you to connect to a Phlex Hub to manage and access multiple Phlex servers through a single interface. This is useful for users with servers in different locations or network environments.

### Features

- **Hub Authentication** - Sign in to your Phlex Hub account
- **Server Switcher** - Quickly switch between your claimed servers
- **Connection Modes**:
  - **Direct** - Connect directly to servers via LAN for lowest latency
  - **Relay** - Route traffic through the hub for remote access
- **Session Persistence** - Hub session persists across app restarts

### Configuration

#### Environment Variable
```
VITE_PHLEX_HUB_URL=https://hub.example.com
```

#### In-App Configuration
1. Open Settings
2. Navigate to Hub Mode section
3. Enter your Hub URL
4. Sign in with your Hub credentials
5. Select a server from your claimed servers list
6. Choose connection mode (Direct or Relay)

### Connection Flow

1. User configures Hub URL and signs in
2. App fetches list of claimed servers from Hub
3. User selects active server and connection mode
4. API calls route through direct-LAN or hub-relay based on mode
5. Active server and connection mode persist across sessions

## Troubleshooting

### Common Issues

**App doesn't start:**
- Ensure Node.js 18+ is installed
- Run `npm install` to install dependencies
- Check console for error messages

**Vite server port conflict:**
- Kill processes using port 5173
- Modify `vite.config.ts` to use a different port

**Build fails with native modules:**
- Run `npm rebuild` to rebuild native dependencies
- Ensure electron-builder is up to date

### Logs

Application logs are stored in:
- **Windows**: `%APPDATA%\phlex-windows\logs\`

Use `electron-log` for runtime logging:
```typescript
import log from 'electron-log';
log.info('Application started');
```

## License

MIT License - see project repository for details.

## Support

For issues and feature requests, please use the GitHub issue tracker.
