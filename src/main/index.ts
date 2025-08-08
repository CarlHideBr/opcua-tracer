import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { OpcUaService } from './opcua';
import * as StoreApi from './store.js';

const SIMULATION = process.env.SIMULATION === 'true';

let mainWindow: BrowserWindow | null = null;
// __dirname in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const opc = new OpcUaService();

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.resolve(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const startUrl = process.env.ELECTRON_START_URL;
  if (startUrl) {
    await mainWindow.loadURL(startUrl);
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Forward live data to renderer
opc.on('data', (d) => {
  if (mainWindow) {
    mainWindow.webContents.send('opcua:data', d);
  }
});

// OPC UA IPC
ipcMain.handle('opcua:connect', async (_e, payload) => {
  await opc.connect(payload);
});

ipcMain.handle('opcua:disconnect', async () => {
  await opc.disconnect();
});

ipcMain.handle('opcua:browseRoot', async () => {
  return await opc.browseRoot();
});

ipcMain.handle('opcua:browseChildren', async (_e, nodeId: string) => {
  return await opc.browseChildren(nodeId);
});

ipcMain.handle('opcua:subscribe', async (_e, nodes, samplingMs) => {
  await opc.subscribe(nodes, samplingMs);
});

ipcMain.handle('opcua:write', async (_e, payload) => {
  return await opc.write(payload);
});

// Store IPC
ipcMain.handle('store:listServers', async () => await StoreApi.listServers());
ipcMain.handle('store:addServer', async (_e, server) => await StoreApi.addServer(server));
ipcMain.handle('store:removeServer', async (_e, id) => await StoreApi.removeServer(id));
ipcMain.handle('store:getCharts', async (_e, serverId?: string) => await StoreApi.getCharts(serverId));
ipcMain.handle('store:saveCharts', async (_e, serverId: string, charts) => await StoreApi.saveCharts(serverId, charts));
