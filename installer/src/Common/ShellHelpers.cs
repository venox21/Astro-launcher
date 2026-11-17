using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Microsoft.Win32;

namespace AstroSetup.Common
{
    internal static class ShellHelpers
    {
        [ComImport]
        [Guid("00021401-0000-0000-C000-000000000046")]
        private class ShellLink
        {
        }

        [ComImport]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        [Guid("000214F9-0000-0000-C000-000000000046")]
        private interface IShellLinkW
        {
            void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszFile, int cchMaxPath, IntPtr pfd, int fFlags);
            void GetIDList(out IntPtr ppidl);
            void SetIDList(IntPtr pidl);
            void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszName, int cchMaxName);
            void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
            void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszDir, int cchMaxPath);
            void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
            void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszArgs, int cchMaxPath);
            void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
            void GetHotkey(out short pwHotkey);
            void SetHotkey(short wHotkey);
            void GetShowCmd(out int piShowCmd);
            void SetShowCmd(int iShowCmd);
            void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszIconPath, int cchIconPath, out int piIcon);
            void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
            void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, int dwReserved);
            void Resolve(IntPtr hwnd, int fFlags);
            void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
        }

        [ComImport]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        [Guid("0000010b-0000-0000-C000-000000000046")]
        private interface IPersistFile
        {
            void GetClassID(out Guid pClassID);
            [PreserveSig]
            int IsDirty();
            void Load([In, MarshalAs(UnmanagedType.LPWStr)] string pszFileName, uint dwMode);
            void Save([In, MarshalAs(UnmanagedType.LPWStr)] string pszFileName, [In, MarshalAs(UnmanagedType.Bool)] bool fRemember);
            void SaveCompleted([In, MarshalAs(UnmanagedType.LPWStr)] string pszFileName);
            void GetCurFile([Out, MarshalAs(UnmanagedType.LPWStr)] out string ppszFileName);
        }

        public static string NormalizeDirectoryPath(string path)
        {
            return Path.GetFullPath(path)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        }

        public static bool IsPathInsideDirectory(string filePath, string directoryPath)
        {
            if (string.IsNullOrWhiteSpace(filePath) || string.IsNullOrWhiteSpace(directoryPath))
            {
                return false;
            }

            string normalizedFile = Path.GetFullPath(filePath);
            string normalizedDir = NormalizeDirectoryPath(directoryPath) + Path.DirectorySeparatorChar;
            return normalizedFile.StartsWith(normalizedDir, StringComparison.OrdinalIgnoreCase);
        }

        public static void CreateShortcut(
            string shortcutPath,
            string targetPath,
            string workingDirectory,
            string iconPath,
            string description)
        {
            string parentDir = Path.GetDirectoryName(shortcutPath);
            if (!string.IsNullOrEmpty(parentDir))
            {
                Directory.CreateDirectory(parentDir);
            }

            IShellLinkW link = (IShellLinkW)new ShellLink();
            try
            {
                link.SetPath(targetPath);
                link.SetWorkingDirectory(workingDirectory);
                link.SetDescription(description);
                link.SetIconLocation(iconPath, 0);

                IPersistFile persistFile = (IPersistFile)link;
                persistFile.Save(shortcutPath, true);
            }
            finally
            {
                Marshal.FinalReleaseComObject(link);
            }
        }

        public static void DeleteFileIfExists(string path)
        {
            if (!string.IsNullOrEmpty(path) && File.Exists(path))
            {
                File.SetAttributes(path, FileAttributes.Normal);
                File.Delete(path);
            }
        }

        public static void StopRunningLauncherInstances(string installDir)
        {
            string processName = Path.GetFileNameWithoutExtension(AstroConstants.MainExecutableName);
            List<Process> matching = FindProcessesInDirectory(processName, installDir);
            if (matching.Count == 0)
            {
                return;
            }

            foreach (Process proc in matching)
            {
                try
                {
                    if (!proc.HasExited && proc.MainWindowHandle != IntPtr.Zero)
                    {
                        proc.CloseMainWindow();
                    }
                }
                catch
                {
                    // Ignore inaccessible or already-exited child processes.
                }
            }

            DateTime deadline = DateTime.UtcNow.AddMilliseconds(1800);
            while (DateTime.UtcNow < deadline)
            {
                bool anyAlive = false;
                foreach (Process proc in matching)
                {
                    try
                    {
                        if (!proc.HasExited)
                        {
                            anyAlive = true;
                            break;
                        }
                    }
                    catch
                    {
                        // Ignore.
                    }
                }

                if (!anyAlive)
                {
                    break;
                }

                Thread.Sleep(120);
            }

            DisposeProcessList(matching);

            // Re-scan and force-kill any remaining Electron helper processes still locked inside installDir.
            List<Process> remaining = FindProcessesInDirectory(processName, installDir);
            foreach (Process proc in remaining)
            {
                try
                {
                    if (!proc.HasExited)
                    {
                        proc.Kill();
                        proc.WaitForExit(2000);
                    }
                }
                catch
                {
                    // Ignore race if process exited concurrently.
                }
            }

            DisposeProcessList(remaining);
            Thread.Sleep(250);
        }

        private static List<Process> FindProcessesInDirectory(string processName, string installDir)
        {
            var result = new List<Process>();
            Process[] candidates = Process.GetProcessesByName(processName);
            foreach (Process proc in candidates)
            {
                bool keep = false;
                try
                {
                    string exePath = proc.MainModule != null ? proc.MainModule.FileName : null;
                    if (IsPathInsideDirectory(exePath, installDir))
                    {
                        keep = true;
                        result.Add(proc);
                    }
                }
                catch
                {
                    // Process may be inaccessible or exited before MainModule was read.
                }
                finally
                {
                    if (!keep)
                    {
                        proc.Dispose();
                    }
                }
            }

            return result;
        }

        private static void DisposeProcessList(List<Process> processes)
        {
            foreach (Process proc in processes)
            {
                proc.Dispose();
            }
        }

        public static void RegisterUninstallEntry(string installDir, string version, long totalUncompressedBytes)
        {
            string exePath = Path.Combine(installDir, AstroConstants.MainExecutableName);
            string uninstallerPath = Path.Combine(installDir, AstroConstants.UninstallerExecutableName);
            int estimatedSizeKb = (int)Math.Max(1, Math.Min(int.MaxValue, totalUncompressedBytes / 1024));

            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(AstroConstants.UninstallRegistryKeyPath))
            {
                if (key == null)
                {
                    throw new InvalidOperationException("Registrierungsschlüssel für Deinstallation konnte nicht erstellt werden.");
                }

                key.SetValue("DisplayName", AstroConstants.AppDisplayName, RegistryValueKind.String);
                key.SetValue("DisplayVersion", version, RegistryValueKind.String);
                key.SetValue("Publisher", AstroConstants.AppPublisher, RegistryValueKind.String);
                key.SetValue("DisplayIcon", exePath + ",0", RegistryValueKind.String);
                key.SetValue("InstallLocation", installDir, RegistryValueKind.String);
                key.SetValue("InstallDate", DateTime.Now.ToString("yyyyMMdd"), RegistryValueKind.String);
                key.SetValue("UninstallString", "\"" + uninstallerPath + "\"", RegistryValueKind.String);
                key.SetValue("QuietUninstallString", "\"" + uninstallerPath + "\" /S", RegistryValueKind.String);
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                key.SetValue("EstimatedSize", estimatedSizeKb, RegistryValueKind.DWord);
            }
        }

        public static string GetRegisteredInstallLocation()
        {
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(AstroConstants.UninstallRegistryKeyPath, false))
            {
                if (key == null)
                {
                    return null;
                }

                return key.GetValue("InstallLocation") as string;
            }
        }

        public static void RemoveUninstallEntry()
        {
            Registry.CurrentUser.DeleteSubKeyTree(AstroConstants.UninstallRegistryKeyPath, false);
        }
    }
}
