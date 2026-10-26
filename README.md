# Wingst

**Your browser. Your space. Your rules.**

Wingst is a customizable personal workspace designed to bring everyday tools into one focused, visually expressive dashboard. Built around an editorial aesthetic and a flexible mosaic layout, Wingst lets you shape your workspace around the way you work.

Customize your environment, organize your shortcuts, track daily activities, take notes, and access useful information without turning your browser into another cluttered productivity app.

## Overview

Wingst combines a customizable visual canvas with a collection of independent, rearrangeable workspace modules.

The goal is simple: a personal dashboard that feels like yours, stays out of your way, and makes everyday browser tasks easier.

### Features

- **Mosaic Workspace** — Arrange dashboard modules in a flexible, asymmetric grid.
- **Custom Appearance** — Personalize themes, primary colors, backgrounds, and visual preferences.
- **Live Backgrounds** — Use static images, animated GIFs, or looping videos.
- **Quick Links** — Organize frequently visited websites in one place.
- **Global Search** — Search the web with a configurable search provider.
- **Weather** — Access current weather conditions and forecasts.
- **Trading & Forex** — View exchange-rate information and historical data.
- **Music** — Access music through supported official embeds.
- **Daily Activity** — Track personal activities and review historical progress.
- **Notepad** — Keep notes accessible directly from your workspace.
- **Prayer Times** — View daily prayer schedules using supported data providers.
- **Local-First Storage** — Keep personal settings and workspace data on your device without requiring an account.
- **Chrome Extension** — Bring the Wingst workspace into a browser New Tab experience.

Feature availability depends on the current implementation, supported providers, and browser environment.

## Design Philosophy

Wingst follows an editorial, dark-first design direction built around strong typography, deliberate contrast, and asymmetric composition.

Rather than relying on generic dashboard templates, the interface prioritizes:

- Intentional visual hierarchy.
- Functional, independently configurable modules.
- Restrained color and decoration.
- Responsive layouts that adapt to different screens.
- Personalization without unnecessary complexity.

The interface should remain useful even when a module has no data or an external service is unavailable.

## Tech Stack

The project is intended to use the following technologies, subject to the current repository implementation:

- React
- TypeScript
- Next.js
- Tailwind CSS
- Browser Storage APIs
- External APIs for supported data integrations
- Chrome Extension APIs (Manifest V3)

## Getting Started

### Prerequisites

- Node.js compatible with the project's dependencies.
- npm.
- Git.

### Installation

Clone the repository:

```bash
git clone <your-repository-url>
cd wingst
```

Install dependencies:

```bash
npm install
```

### Environment Configuration

Create a `.env.local` file in the project root if the application requires environment variables.

```env
# Add only the environment variables required by your implementation.
```

Configure any required API credentials according to the corresponding provider's documentation.

Do not commit `.env.local` or expose secret API keys in client-side code or a publicly distributed browser extension.

Wingst's core local workspace should not require a Gemini API key unless an implemented feature explicitly depends on Gemini.

### Run Development Server

```bash
npm run dev
```

Open the local URL printed by the development server, typically:

```text
http://localhost:3000
```

The actual port depends on the framework configuration and port availability.

### Production Build

```bash
npm run build
```

Run the production server when supported by the configured framework:

```bash
npm run start
```

For static deployments or Chrome Extension builds, follow the output and commands defined by the project's actual build configuration.

## Chrome Extension

Wingst is designed to support a Chrome New Tab experience through a Manifest V3 extension.

The extension should reuse the shared workspace components while maintaining storage and API integrations appropriate to the extension environment.

Once the extension build is configured:

1. Generate the extension package using the project's build command.
2. Open `chrome://extensions` in Google Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the generated extension directory.

The selected directory must contain a valid `manifest.json`.

Extension build commands and output directories depend on the repository's actual configuration. Do not assume the website's development server output can be loaded directly into Chrome.

## Privacy & Storage

Wingst follows a local-first approach.

- No account is required for core workspace functionality.
- Personal notes, daily activities, and preferences are intended to remain stored locally.
- Website storage and Chrome Extension storage are separate by default.
- External API requests may be used for weather, exchange rates, prayer times, and embedded music services.
- Data export and reset options should allow users to manage their local workspace data.

Local-first storage does not automatically provide cloud backup or synchronization between devices.

## Project Status

Wingst is an evolving project focused on a customizable browser workspace, a distinctive visual identity, and a functional Chrome Extension experience.

Features should be considered complete only when implemented and tested in the actual application.

## Development Principles

- Preserve existing working functionality.
- Avoid unnecessary dependencies and architectural changes.
- Keep components modular and maintainable.
- Never substitute fabricated data for real API responses.
- Handle loading, empty, offline, and error states.
- Prioritize usability, performance, accessibility, and responsive behavior.
- Keep the interface intentional rather than decoration-heavy.

## License

No license has been specified yet. Until a license is added to the repository, all rights remain with the respective copyright holder.

---

**Wingst** — A workspace that adapts to you, not the other way around.