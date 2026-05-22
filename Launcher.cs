using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Windows.Forms;
using System.Drawing;
using System.Net;

class Program {
    private static Form splash;
    private static Label label;

    [STAThread]
    static void Main() {
        // Prevent multiple running instances of the launcher
        bool createdNew;
        using (Mutex mutex = new Mutex(true, "CENTENARYO_SYSTEM_MUTEX", out createdNew)) {
            if (!createdNew) {
                MessageBox.Show("Ang CENTENARYO system ay kasalukuyan nang tumatakbo.", "CENTENARYO", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string backendDir = Path.Combine(baseDir, "backend");

            // 1. Clean up any existing running instances of node or python to free ports
            try {
                ProcessStartInfo killNode = new ProcessStartInfo("taskkill.exe", "/F /IM node.exe");
                killNode.CreateNoWindow = true;
                killNode.UseShellExecute = false;
                Process proc = Process.Start(killNode);
                if (proc != null) {
                    proc.WaitForExit();
                }
            } catch {}

            try {
                ProcessStartInfo killPython = new ProcessStartInfo("taskkill.exe", "/F /IM python.exe");
                killPython.CreateNoWindow = true;
                killPython.UseShellExecute = false;
                Process proc = Process.Start(killPython);
                if (proc != null) {
                    proc.WaitForExit();
                }
            } catch {}

            // Wait brief moment for ports to clear
            Thread.Sleep(1000);

            // 2. Show Loading / Splash Screen
            Thread splashThread = new Thread(new ThreadStart(ShowSplashScreen));
            splashThread.SetApartmentState(ApartmentState.STA);
            splashThread.Start();

            // Wait for splash form to be instantiated
            while (splash == null) {
                Thread.Sleep(50);
            }

            // 3. Launch Django Backend Process (Silently, serving both API and Frontend static pages)
            UpdateSplashText("Inihahanda ang Python Backend & React App...");
            ProcessStartInfo backendInfo = new ProcessStartInfo();
            backendInfo.FileName = "cmd.exe";
            backendInfo.Arguments = "/c venv\\Scripts\\python.exe manage.py runserver --noreload";
            backendInfo.WorkingDirectory = backendDir;
            backendInfo.CreateNoWindow = true;
            backendInfo.UseShellExecute = false;

            try {
                Process.Start(backendInfo);
            } catch (Exception ex) {
                CloseSplashScreen();
                MessageBox.Show("Failed to start Django Backend:\n" + ex.Message, "CENTENARYO System Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            // 4. Poll local server on Port 8000 until it is active
            UpdateSplashText("Kumokonekta sa local server...");
            
            // Wait at least 1 second before checking
            Thread.Sleep(1000);

            try {
                for (int i = 0; i < 30; i++) { // Poll for up to 30 seconds
                    try {
                        HttpWebRequest request = (HttpWebRequest)WebRequest.Create("http://localhost:8000");
                        request.Timeout = 1000;
                        using (HttpWebResponse response = (HttpWebResponse)request.GetResponse()) {
                            if (response.StatusCode == HttpStatusCode.OK) {
                                break;
                            }
                        }
                    } catch {
                        // Still loading/starting up
                    }
                    Thread.Sleep(1000);
                }
            } catch {
                Thread.Sleep(3000);
            }

            // Close the splash screen
            CloseSplashScreen();

            // 5. Open in a Standalone App Window (App Mode) using Chrome or Edge
            bool launched = false;
            
            // Try Chrome App Mode first
            try {
                ProcessStartInfo chromeApp = new ProcessStartInfo();
                chromeApp.FileName = "chrome.exe";
                chromeApp.Arguments = "--app=http://localhost:8000";
                Process.Start(chromeApp);
                launched = true;
            } catch {
                // Chrome is not installed, fallback to Microsoft Edge
            }

            // Try Microsoft Edge App Mode if Chrome is missing
            if (!launched) {
                try {
                    ProcessStartInfo edgeApp = new ProcessStartInfo();
                    edgeApp.FileName = "msedge.exe";
                    edgeApp.Arguments = "--app=http://localhost:8000";
                    Process.Start(edgeApp);
                    launched = true;
                } catch {
                    // Fallback to default browser if both app modes fail
                }
            }

            // Ultimate fallback to default browser shell association if app modes are blocked
            if (!launched) {
                try {
                    Process.Start(new ProcessStartInfo("http://localhost:8000") { UseShellExecute = true });
                } catch {
                    try {
                        Process.Start("explorer.exe", "http://localhost:8000");
                    } catch {}
                }
            }
        }
    }

    private static void ShowSplashScreen() {
        splash = new Form();
        splash.Text = "CENTENARYO Launcher";
        splash.Size = new Size(420, 200);
        splash.StartPosition = FormStartPosition.CenterScreen;
        splash.FormBorderStyle = FormBorderStyle.FixedDialog;
        splash.MaximizeBox = false;
        splash.MinimizeBox = false;
        splash.BackColor = Color.FromArgb(15, 23, 42); // Dark slate background matching app theme

        // Panel for branding
        Panel panel = new Panel();
        panel.Dock = DockStyle.Fill;
        panel.Padding = new Padding(20);

        Label title = new Label();
        title.Text = "🇵🇭 CENTENARYO SYSTEM";
        title.Dock = DockStyle.Top;
        title.Height = 40;
        title.ForeColor = Color.White;
        title.Font = new Font("Segoe UI", 16, FontStyle.Bold);
        title.TextAlign = ContentAlignment.MiddleCenter;

        label = new Label();
        label.Text = "Inihahanda ang system, mangyaring maghintay...";
        label.Dock = DockStyle.Fill;
        label.ForeColor = Color.FromArgb(148, 163, 184); // Slate-400
        label.Font = new Font("Segoe UI", 10, FontStyle.Regular);
        label.TextAlign = ContentAlignment.MiddleCenter;

        panel.Controls.Add(label);
        panel.Controls.Add(title);
        splash.Controls.Add(panel);

        Application.Run(splash);
    }

    private static void UpdateSplashText(string text) {
        if (splash != null && splash.InvokeRequired) {
            splash.Invoke(new Action<string>(UpdateSplashText), text);
        } else if (label != null) {
            label.Text = text;
        }
    }

    private static void CloseSplashScreen() {
        if (splash != null && splash.InvokeRequired) {
            splash.Invoke(new Action(CloseSplashScreen));
        } else if (splash != null) {
            splash.Close();
            splash = null;
        }
    }
}
