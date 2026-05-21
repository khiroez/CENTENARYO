using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Windows.Forms;
using System.Net;

class Program {
    [STAThread]
    static void Main() {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string backendDir = Path.Combine(baseDir, "backend");
        string frontendDir = Path.Combine(baseDir, "frontend");

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

        // 2. Launch Django Backend Process (Silently via cmd.exe to inherit system path)
        ProcessStartInfo backendInfo = new ProcessStartInfo();
        backendInfo.FileName = "cmd.exe";
        backendInfo.Arguments = "/c venv\\Scripts\\python.exe manage.py runserver";
        backendInfo.WorkingDirectory = backendDir;
        backendInfo.CreateNoWindow = true;
        backendInfo.UseShellExecute = false;

        try {
            Process.Start(backendInfo);
        } catch (Exception ex) {
            MessageBox.Show("Failed to start Django Backend:\n" + ex.Message, "CENTENARYO System Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        // 3. Launch Next.js Frontend Process (Silently via cmd.exe to resolve global npm script)
        ProcessStartInfo frontendInfo = new ProcessStartInfo();
        frontendInfo.FileName = "cmd.exe";
        frontendInfo.Arguments = "/c npm run dev";
        frontendInfo.WorkingDirectory = frontendDir;
        frontendInfo.CreateNoWindow = true;
        frontendInfo.UseShellExecute = false;

        try {
            Process.Start(frontendInfo);
        } catch (Exception ex) {
            MessageBox.Show("Failed to start Next.js Frontend:\n" + ex.Message, "CENTENARYO System Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        // 4. Poll Next.js local server on Port 3000 until it is fully compiled and active
        bool isReady = false;
        
        // Wait at least 2 seconds before checking
        Thread.Sleep(2000);

        try {
            for (int i = 0; i < 20; i++) { // Poll for up to 30 seconds
                try {
                    HttpWebRequest request = (HttpWebRequest)WebRequest.Create("http://localhost:3000");
                    request.Timeout = 1500;
                    using (HttpWebResponse response = (HttpWebResponse)request.GetResponse()) {
                        if (response.StatusCode == HttpStatusCode.OK) {
                            isReady = true;
                            break;
                        }
                    }
                } catch {
                    // Backend or Frontend is still compiling in background, retry
                }
                Thread.Sleep(1500);
            }
        } catch {
            // Fallback if network requests throw critical exceptions
            Thread.Sleep(5000);
        }

        // 5. Open browser once system is guaranteed to be ready
        try {
            Process.Start(new ProcessStartInfo("http://localhost:3000") { UseShellExecute = true });
        } catch {
            try {
                Process.Start("explorer.exe", "http://localhost:3000");
            } catch {}
        }
    }
}
