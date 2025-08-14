// CommonJS on purpose (works regardless of "type" in package.json)
const { app, BrowserWindow }  = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

function resolvePreload() {
  // Candidates to try in order (edit to match your layout)
  const candidates = [
    // same dir as electron.js (recommended placement)
    path.join(__dirname, 'preload.cjs'),
    path.join(__dirname, 'preload.js'),

    // if you prefer keeping it in src/ during dev
    path.join(__dirname, 'src', 'preload.cjs'),
    path.join(__dirname, 'src', 'preload.js'),

    // if you copy it into dist/ during packaging
    path.join(__dirname, 'dist', 'preload.cjs'),
    path.join(__dirname, 'dist', 'preload.js'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log('[electron] Using preload:', p);
      return p;
    }
  }
  const tried = candidates.map(p => `- ${p}`).join('\n');
  throw new Error(`Preload file not found. Tried:\n${tried}`);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: resolvePreload(),
    },
  });

  win.webContents.setZoomFactor(1.0);

  if (isDev) {
    const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    win.loadURL(url).catch(err => {
      console.error('Failed to load dev server:', err);
    });
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Make sure your Vite config has: export default defineConfig({ base: './', ... })
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    win.loadFile(indexPath).catch(err => {
      console.error('Failed to load file:', indexPath, err);
    });
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
