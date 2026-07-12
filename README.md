# Portfolio World

A Bruno Simon–inspired **3D portfolio** — explore a pink city as a cat, follow the brick path, and discover projects along the way.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5174](http://localhost:5174)

## Controls

- **WASD** or **arrow keys** — move
- **Shift** — sprint
- Walk near pink markers to open project panels
- Click centered project photo in lightbox… (N/A here — walk to zones)

## Stack

- [Vite](https://vitejs.dev/)
- [Three.js](https://threejs.org/)

## Features

- Pink → white gradient sky (CSS + fog)
- Procedural grey/black city buildings with sun shading (top-left)
- 3D pink brick **RHIANNON** letters at the start
- Brick path winding through the city to portfolio waypoints
- Playable low-poly cat with third-person camera

## Deploy

```bash
npm run build
```

Deploy the `dist/` folder to GitHub Pages, Render Static Site, or Netlify.
