const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');

let mainWindow;
let loadingWindow;
let backendProcess;
let frontendProcess;
let isShuttingDown = false;

// Helper to kill process tree in Windows
function killProcess(proc, label) {
  if (!proc) return;
  console.log(`Terminating ${label} process tree...`);
  try {
    exec(`taskkill /F /T /PID ${proc.pid}`, (err) => {
      if (err) {
        // Fallback standard kill
        proc.kill('SIGINT');
      }
    });
  } catch (e) {
    proc.kill('SIGINT');
  }
}

// Function to poll the Next.js frontend port until it is ready
function pollServer(url, callback) {
  const check = () => {
    if (isShuttingDown) return;
    
    http.get(url, (res) => {
      if (res.statusCode === 200) {
        callback();
      } else {
        setTimeout(check, 1000);
      }
    }).on('error', () => {
      setTimeout(check, 1000);
    });
  };
  check();
}

function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 500,
    height: 380,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false
    }
  });

  // Minimal premium splash screen HTML directly loaded
  const splashHtml = `
    <html>
      <head>
        <style>
          body {
            background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            overflow: hidden;
            border-radius: 24px;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.1);
          }
          .logo {
            font-size: 32px;
            font-weight: 900;
            letter-spacing: -0.05em;
            margin-bottom: 8px;
            background: linear-gradient(to right, #34d399, #10b981);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .subtitle {
            font-size: 11px;
            font-weight: bold;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.25em;
            margin-bottom: 30px;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(16, 185, 129, 0.1);
            border-top: 4px solid #10b981;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          .loading-text {
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #64748b;
            margin-top: 15px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="logo">CENTENARYO</div>
        <div class="subtitle">LGU Digital Milestone System</div>
        <div class="spinner"></div>
        <div class="loading-text">Starting internal registry & AI engines...</div>
      </body>
    </html>
  `;

  loadingWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false, // Don't show until ready
    title: "CENTENARYO - LGU Digital Milestone System",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Hide the default standard window menu bar for a beautiful app-like feel
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadURL('http://localhost:3000');

  mainWindow.once('ready-to-show', () => {
    if (loadingWindow) {
      loadingWindow.close();
    }
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
}

function startServers() {
  const rootPath = path.resolve(__dirname, '..');
  
  // 1. Spawning Django Backend
  console.log("Spawning Django Backend Process...");
  backendProcess = spawn('venv\\Scripts\\python.exe', ['manage.py', 'runserver'], { 
    shell: true,
    cwd: path.join(rootPath, 'backend')
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend stdout]: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend stderr]: ${data}`);
  });

  // 2. Spawning Next.js Frontend
  console.log("Spawning Next.js Frontend Process...");
  frontendProcess = spawn('npm', ['run', 'dev'], { 
    shell: true,
    cwd: path.join(rootPath, 'frontend')
  });

  frontendProcess.stdout.on('data', (data) => {
    console.log(`[Frontend stdout]: ${data}`);
  });

  frontendProcess.stderr.on('data', (data) => {
    console.error(`[Frontend stderr]: ${data}`);
  });
}

app.on('ready', () => {
  createLoadingWindow();
  startServers();
  
  // Poll the frontend local port 3000 before switching windows
  pollServer('http://localhost:3000', () => {
    createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// App termination triggers background cleanups
app.on('will-quit', () => {
  isShuttingDown = true;
  killProcess(backendProcess, "Django Backend");
  killProcess(frontendProcess, "Next.js Frontend");
});
