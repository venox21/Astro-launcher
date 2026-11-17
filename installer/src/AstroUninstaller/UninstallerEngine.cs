using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using AstroSetup.Common;

namespace AstroUninstaller
{
    internal static class UninstallerEngine
    {
        public static string ResolveTargetDirectory()
        {
            string baseDir = ShellHelpers.NormalizeDirectoryPath(AppDomain.CurrentDomain.BaseDirectory);
            string registered = ShellHelpers.GetRegisteredInstallLocation();
            if (!string.IsNullOrWhiteSpace(registered))
            {
                registered = ShellHelpers.NormalizeDirectoryPath(registered);
            }

            if (IsSafeUninstallTarget(baseDir, registered))
            {
                return baseDir;
            }

            if (!string.IsNullOrWhiteSpace(registered) &&
                Directory.Exists(registered) &&
                IsSafeUninstallTarget(registered, registered))
            {
                return registered;
            }

            string defaultDir = ShellHelpers.NormalizeDirectoryPath(AstroConstants.GetDefaultInstallDirectory());
            if (Directory.Exists(defaultDir) && IsSafeUninstallTarget(defaultDir, registered))
            {
                return defaultDir;
            }

            return null;
        }

        public static bool IsSafeUninstallTarget(string candidateDir, string registeredDir)
        {
            if (string.IsNullOrWhiteSpace(candidateDir) || !Directory.Exists(candidateDir))
            {
                return false;
            }

            string normalized = ShellHelpers.NormalizeDirectoryPath(candidateDir);
            string root = ShellHelpers.NormalizeDirectoryPath(Path.GetPathRoot(normalized) ?? string.Empty);
            if (string.Equals(normalized, root, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            foreach (string forbidden in GetForbiddenFolders())
            {
                if (!string.IsNullOrEmpty(forbidden) &&
                    string.Equals(normalized, forbidden, StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }
            }

            bool matchesRegistered = !string.IsNullOrWhiteSpace(registeredDir) &&
                string.Equals(normalized, ShellHelpers.NormalizeDirectoryPath(registeredDir), StringComparison.OrdinalIgnoreCase);

            bool hasLauncherFiles = File.Exists(Path.Combine(normalized, AstroConstants.MainExecutableName)) ||
                File.Exists(Path.Combine(normalized, "resources", "app.asar"));

            return matchesRegistered || hasLauncherFiles;
        }

        private static IEnumerable<string> GetForbiddenFolders()
        {
            Environment.SpecialFolder[] folders =
            {
                Environment.SpecialFolder.Desktop,
                Environment.SpecialFolder.DesktopDirectory,
                Environment.SpecialFolder.MyDocuments,
                Environment.SpecialFolder.LocalApplicationData,
                Environment.SpecialFolder.ApplicationData,
                Environment.SpecialFolder.Programs,
                Environment.SpecialFolder.StartMenu,
                Environment.SpecialFolder.ProgramFiles,
                Environment.SpecialFolder.ProgramFilesX86,
                Environment.SpecialFolder.Windows,
                Environment.SpecialFolder.System,
                Environment.SpecialFolder.UserProfile
            };

            foreach (Environment.SpecialFolder folder in folders)
            {
                string path = Environment.GetFolderPath(folder);
                if (!string.IsNullOrWhiteSpace(path))
                {
                    yield return ShellHelpers.NormalizeDirectoryPath(path);
                }
            }

            yield return ShellHelpers.NormalizeDirectoryPath(Path.GetTempPath());
        }

        public static void Uninstall(string targetDir, Action<string> onStatus)
        {
            onStatus?.Invoke("Laufende Launcher-Prozesse werden beendet …");
            ShellHelpers.StopRunningLauncherInstances(targetDir);

            onStatus?.Invoke("Verknüpfungen werden entfernt …");
            ShellHelpers.DeleteFileIfExists(AstroConstants.GetDesktopShortcutPath());
            ShellHelpers.DeleteFileIfExists(AstroConstants.GetStartMenuShortcutPath());

            onStatus?.Invoke("Windows-Eintrag wird entfernt …");
            ShellHelpers.RemoveUninstallEntry();

            onStatus?.Invoke("Installationsdateien werden gelöscht …");
            string currentExePath = Path.GetFullPath(Assembly.GetExecutingAssembly().Location);
            bool runningInsideTarget = ShellHelpers.IsPathInsideDirectory(currentExePath, targetDir);

            DeleteDirectoryContents(targetDir, runningInsideTarget ? currentExePath : null);

            if (runningInsideTarget)
            {
                ScheduleSelfCleanup(currentExePath, targetDir);
            }
            else if (Directory.Exists(targetDir))
            {
                try
                {
                    Directory.Delete(targetDir, true);
                }
                catch
                {
                    ScheduleDirectoryCleanup(targetDir);
                }
            }
        }

        private static void DeleteDirectoryContents(string directory, string preserveFilePath)
        {
            if (!Directory.Exists(directory))
            {
                return;
            }

            foreach (string file in Directory.GetFiles(directory))
            {
                if (preserveFilePath != null &&
                    string.Equals(Path.GetFullPath(file), preserveFilePath, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                try
                {
                    File.SetAttributes(file, FileAttributes.Normal);
                    File.Delete(file);
                }
                catch
                {
                    // Locked files inside target will be swept on cleanup pass if possible.
                }
            }

            foreach (string subDir in Directory.GetDirectories(directory))
            {
                try
                {
                    ClearReadOnlyAttributes(subDir);
                    Directory.Delete(subDir, true);
                }
                catch
                {
                    // Best effort cleanup.
                }
            }
        }

        private static void ClearReadOnlyAttributes(string rootDir)
        {
            foreach (string file in Directory.GetFiles(rootDir, "*", SearchOption.AllDirectories))
            {
                File.SetAttributes(file, FileAttributes.Normal);
            }
        }

        private static void ScheduleSelfCleanup(string exePath, string targetDir)
        {
            string args = string.Format(
                "/c ping 127.0.0.1 -n 2 >nul & del /f /q \"{0}\" & rmdir /s /q \"{1}\"",
                exePath,
                targetDir);

            StartHiddenCmd(args);
        }

        private static void ScheduleDirectoryCleanup(string targetDir)
        {
            string args = string.Format(
                "/c ping 127.0.0.1 -n 2 >nul & rmdir /s /q \"{0}\"",
                targetDir);

            StartHiddenCmd(args);
        }

        private static void StartHiddenCmd(string arguments)
        {
            var psi = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = arguments,
                WorkingDirectory = Path.GetTempPath(),
                CreateNoWindow = true,
                UseShellExecute = false,
                WindowStyle = ProcessWindowStyle.Hidden
            };

            Process.Start(psi);
        }
    }
}
