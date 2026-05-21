using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Windows.Forms;

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

        // 2. Launch Django Backend Process (Directly, completely silent)
        ProcessStartInfo backendInfo = new ProcessStartInfo();
        backendInfo.FileName = Path.Combine(backendDir, "venv\\Scripts\\python.exe");
        backendInfo.Arguments = "manage.py runserver";
        backendInfo.WorkingDirectory = backendDir;
        backendInfo.CreateNoWindow = true;
        backendInfo.UseShellExecute = false;

        try {
            Process.Start(backendInfo);
        } catch (Exception ex) {
            MessageBox.Show("Failed to start Django Backend:\n" + ex.Message, "CENTENARYO System Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        // Wait 2 seconds for backend initialization
        Thread.Sleep(2000);

        // 3. Launch Next.js Frontend Process (Directly, completely silent)
        ProcessStartInfo frontendInfo = new ProcessStartInfo();
        frontendInfo.FileName = "npm.cmd";
        frontendInfo.Arguments = "run dev";
        frontendInfo.WorkingDirectory = frontendDir;
        frontendInfo.CreateNoWindow = true;
        frontendInfo.UseShellExecute = false;

        try {
            Process.Start(frontendInfo);
        } catch (Exception ex) {
            MessageBox.Show("Failed to start Next.js Frontend:\n" + ex.Message, "CENTENARYO System Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        // Wait 3 seconds for frontend compilation to warm up and open browser
        Thread.Sleep(3000);
        try {
            Process.Start(new ProcessStartInfo("http://localhost:3000") { UseShellExecute = true });
        } catch {
            try {
                Process.Start("explorer.exe", "http://localhost:3000");
            } catch {}
        }
    }
}
