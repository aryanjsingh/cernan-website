# Cernan website

A minimal foundation for a 3D website. The starter scene verifies the graphics stack; it is not the final site design.

## Run locally

Use Node.js 22.12+ (Node 22 LTS recommended) and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Commands

- `npm run dev`: development server with hot updates.
- `npm run build`: TypeScript checks and production output in `dist/`.
- `npm run preview`: serve the production build locally.
- `npm run typecheck`: check TypeScript.
- `npm run lint`: run Oxlint.

## Stack

- React 19 and TypeScript for components and type safety.
- Vite for local development and production builds.
- Three.js, React Three Fiber, and Drei for 3D scenes and controls.
- Motion for interface transitions, respecting reduced-motion preferences.
- Plain CSS for styling without another framework to maintain.

## Structure

Typography uses self-hosted Oxanium Variable globally via `--font-family` in `src/index.css`. New components should inherit this font, including form controls, code text, and SVG labels; do not introduce component-specific font families.

- `branding/logo.png`: the selected logo, imported directly by the application.
- `src/App.tsx`: starter page and lazy loading of the 3D scene.
- `src/components/Scene.tsx`: isolated scene, lighting, and orbit controls.
- `src/index.css`: global styling.

The scene renders on demand and caps pixel ratio at 1.5 to limit GPU work. 3D code loads separately from the page; the canvas provides a fallback for devices without WebGL. The starter uses local geometry and lights, with no remote 3D asset dependencies.

This is a client-side frontend. Backend, CMS, routing, and hosting can be selected when the site's content and functionality are defined.

Documentation: [Vite](https://vite.dev/guide/), [React Three Fiber](https://r3f.docs.pmnd.rs/getting-started/introduction), [Drei](https://drei.docs.pmnd.rs/), [Motion](https://motion.dev/docs/react).

## Navigation components

Spectrum UI is configured in `components.json`; install further components with `npx shadcn@latest add @spectrumui/<name>`. The topbar adapts Spectrum's floating-navbar with Radix dropdown keyboard and focus handling. Tailwind v4 supports the shared primitives; site typography remains Oxanium.

Services, Work, About, and Contact link to future homepage section IDs (`services`, `work`, `about`, `contact`). These content sections have not been built yet.
