const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let trayIcon = null;

const storePath = path.join(app.getPath('userData'), 'pomodoro-data.json');

function readStore() {
  try { return JSON.parse(fs.readFileSync(storePath, 'utf8')); } catch { return {}; }
}

function storeGet(key) {
  return readStore()[key];
}

function storeSet(key, value) {
  const data = readStore();
  data[key] = value;
  fs.writeFileSync(storePath, JSON.stringify(data));
}

function getTrayIcon() {
  if (!trayIcon) {
    trayIcon = nativeImage.createFromPath(path.join(__dirname, 'src', 'assets', 'icon.png'));
  }
  return trayIcon;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400, height: 520, resizable: false, frame: false, show: false,
    icon: getTrayIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.once('ready-to-show', () => { mainWindow.show(); });
}

function showWindow() {
  if (!mainWindow) createWindow();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  tray = new Tray(getTrayIcon());
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示窗口', click: showWindow },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setToolTip('番茄钟');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', showWindow);
}

ipcMain.handle('store-get', (_e, key) => storeGet(key));
ipcMain.handle('store-set', (_e, key, value) => storeSet(key, value));
ipcMain.handle('show-notification', (_e, title, body) => {
  if (Notification.isSupported()) new Notification({ title, body, silent: true }).show();
});
ipcMain.handle('flash-window', () => {
  if (mainWindow) { mainWindow.flashFrame(true); setTimeout(() => mainWindow.flashFrame(false), 4000); }
});
ipcMain.handle('minimize-window', () => { if (mainWindow) mainWindow.minimize(); });

app.whenReady().then(() => { createWindow(); createTray(); });
app.on('window-all-closed', () => {});
app.on('before-quit', () => { app.isQuitting = true; });
