# CleanUp 🧹

A modern, native Windows desktop utility for real storage analysis and safe disk cleanup. Built with Electron 35, React 19, TypeScript, and native SQLite caching.

---

## 🌟 Key Features

- **Real Storage Analysis**: Scans actual Windows drives with zero simulated/mock data. Categorizes disk usage into `SAFE_TO_CLEAN`, `REVIEW_REQUIRED`, and strictly `PROTECTED` boundaries.
- **3-Stage Duplicate Finder**: Detects identical files by binary cryptographic content (not merely duplicate names) using a staged pipeline:
  1. *Size Binning* — eliminates unique file sizes immediately without hashing.
  2. *Quick Fingerprint* — reads deterministic samples from the start, middle, and end.
  3. *Streaming SHA-256* — streams cryptographic hash with bounded RAM consumption.
- **Persistent SQLite Hash Cache (`node:sqlite`)**: Local zero-dependency SQLite database (WAL mode) that tracks validated hashes by file path, size, and modification timestamp. Accelerates subsequent duplicate scans by **>5x**.
- **15-Point Safety Gate**: Strict pre-movement checks verify file existence, reject symlinks/directory junctions, validate canonical paths, and enforce Windows system protection.
- **Reversible Deletion (Recycle Bin Only)**: Selected duplicate files are never permanently unlinked (`fs.unlinkSync` is blocked). Items are safely relocated to the **Windows Recycle Bin**, preserving user recoverability.
- **Preserved Originals**: At least one original copy is always maintained per duplicate group.
- **59/59 Automated Tests**: Comprehensive unit and integration test coverage across scanner safety, hash caching, duplicate resolution, and storage calculations.

---

## 🛠️ Tech Stack

- **Core & Runtime**: [Electron 35](https://www.electronjs.org/), [Node.js 22](https://nodejs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict mode across Main, Preload, and Renderer)
- **Frontend UI**: [React 19](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Bundler**: [Vite 6](https://vitejs.dev/)
- **Database / Cache**: Native `node:sqlite` (`DatabaseSync` in WAL mode)
- **Packaging**: [electron-builder](https://www.electron.build/) (NSIS Setup Installer & Standalone Portable `.exe`)

---

## 🚀 Getting Started

### Prerequisites

- Windows 10/11
- [Node.js](https://nodejs.org/) v22 or later
- npm v10 or later

### Installation

1. Clone repository:
   ```bash
   git clone https://github.com/your-username/clean-up.git
   cd clean-up
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Run the development server with live reload:
```bash
npm run dev
```

### Running Tests

Run the complete test suite (59 automated unit & integration tests):
```bash
npm test
```

### Type Checking

```bash
npm run check-types
```

### Production Build & Packaging

Build the frontend and main processes:
```bash
npm run build
```

Generate Windows executables (saved to `release/`):
- **Build both NSIS Installer & Portable .exe**:
  ```bash
  npm run dist
  ```
- **Build NSIS Installer only**:
  ```bash
  npm run dist:installer
  ```
- **Build Portable Executable only**:
  ```bash
  npm run dist:portable
  ```

---

## 🔒 Safety Philosophy

CleanUp follows the core product principle:
> **"Safety over Aggressive Cleanup"**

1. No automatic or silent background deletions.
2. Every destructive action requires explicit user confirmation.
3. Protected system directories (`C:\Windows`, `Program Files`, `System32`, registry, etc.) are strictly read-only and unreachable by the cleanup engine.
4. Trashed items are moved to the OS Recycle Bin, allowing simple recovery at any time.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
