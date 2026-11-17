using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading;
using AstroSetup.Common;

namespace AstroInstaller
{
    internal sealed class InstallProgress
    {
        public double Percent { get; set; }
        public string Status { get; set; }
        public string Detail { get; set; }
        public string SizeText { get; set; }
    }

    internal static class InstallerEngine
    {
        private const int CopyBufferSize = 81920;

        public static void Install(
            string version,
            bool launchAfterInstall,
            Action<InstallProgress> reportProgress,
            CancellationToken cancellationToken)
        {
            string installDir = ShellHelpers.NormalizeDirectoryPath(AstroConstants.GetDefaultInstallDirectory());
            string installDirPrefix = installDir + Path.DirectorySeparatorChar;

            using (Stream payloadStream = OpenPayloadStream())
            using (var archive = new ZipArchive(payloadStream, ZipArchiveMode.Read))
            {
                long totalBytes = ComputeTotalUncompressedBytes(archive);
                string totalMbText = FormatMegabytes(totalBytes);

                Report(reportProgress, 0, "Vorbereitung …", "Prüfe laufende Launcher-Instanzen", "0 / " + totalMbText);
                cancellationToken.ThrowIfCancellationRequested();

                ShellHelpers.StopRunningLauncherInstances(installDir);
                Directory.CreateDirectory(installDir);

                long bytesWritten = 0;
                var buffer = new byte[CopyBufferSize];
                var stopwatch = Stopwatch.StartNew();
                long lastUiUpdateMs = -100;

                foreach (ZipArchiveEntry entry in archive.Entries)
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    string relativePath = entry.FullName.Replace('/', Path.DirectorySeparatorChar);
                    if (string.IsNullOrWhiteSpace(relativePath))
                    {
                        continue;
                    }

                    string destinationPath = Path.GetFullPath(Path.Combine(installDir, relativePath));
                    if (!destinationPath.StartsWith(installDirPrefix, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidOperationException("Ungültiger Archivpfad erkannt: " + entry.FullName);
                    }

                    if (relativePath.EndsWith(Path.DirectorySeparatorChar.ToString(), StringComparison.Ordinal))
                    {
                        Directory.CreateDirectory(destinationPath);
                        continue;
                    }

                    string parentDir = Path.GetDirectoryName(destinationPath);
                    if (!string.IsNullOrEmpty(parentDir))
                    {
                        Directory.CreateDirectory(parentDir);
                    }

                    string displayEntry = entry.FullName;
                    using (Stream entryStream = entry.Open())
                    using (var output = new FileStream(destinationPath, FileMode.Create, FileAccess.Write, FileShare.None, CopyBufferSize))
                    {
                        int read;
                        while ((read = entryStream.Read(buffer, 0, buffer.Length)) > 0)
                        {
                            cancellationToken.ThrowIfCancellationRequested();
                            output.Write(buffer, 0, read);
                            bytesWritten += read;

                            long elapsedMs = stopwatch.ElapsedMilliseconds;
                            if (elapsedMs - lastUiUpdateMs >= 35)
                            {
                                lastUiUpdateMs = elapsedMs;
                                double pct = totalBytes > 0 ? Math.Min(96.0, (bytesWritten * 96.0) / totalBytes) : 96.0;
                                Report(
                                    reportProgress,
                                    pct,
                                    "ASTRO Launcher wird installiert …",
                                    displayEntry,
                                    FormatMegabytes(bytesWritten) + " / " + totalMbText);
                            }
                        }
                    }
                }

                cancellationToken.ThrowIfCancellationRequested();

                Report(reportProgress, 97, "Verknüpfungen werden erstellt …", "Desktop & Startmenü", totalMbText + " / " + totalMbText);
                CreateShortcuts(installDir);

                Report(reportProgress, 99, "Installation wird registriert …", "Windows Apps & Features", totalMbText + " / " + totalMbText);
                ShellHelpers.RegisterUninstallEntry(installDir, version, totalBytes);

                Report(
                    reportProgress,
                    100,
                    launchAfterInstall ? "Fertig! ASTRO Launcher wird gestartet …" : "Installation abgeschlossen!",
                    installDir,
                    totalMbText + " / " + totalMbText);

                if (launchAfterInstall)
                {
                    LaunchInstalledApp(installDir);
                }
            }
        }

        private static Stream OpenPayloadStream()
        {
            Assembly assembly = Assembly.GetExecutingAssembly();
            Stream stream = assembly.GetManifestResourceStream(AstroConstants.PayloadResourceName);
            if (stream != null)
            {
                return stream;
            }

            foreach (string name in assembly.GetManifestResourceNames())
            {
                if (name.EndsWith("payload.zip", StringComparison.OrdinalIgnoreCase))
                {
                    Stream fallback = assembly.GetManifestResourceStream(name);
                    if (fallback != null)
                    {
                        return fallback;
                    }
                }
            }

            throw new InvalidOperationException("Installationspaket (payload.zip) wurde nicht im Installer gefunden.");
        }

        private static long ComputeTotalUncompressedBytes(ZipArchive archive)
        {
            long total = 0;
            foreach (ZipArchiveEntry entry in archive.Entries)
            {
                total += Math.Max(0L, entry.Length);
            }
            return total;
        }

        private static void CreateShortcuts(string installDir)
        {
            string targetExe = Path.Combine(installDir, AstroConstants.MainExecutableName);
            ShellHelpers.CreateShortcut(
                AstroConstants.GetDesktopShortcutPath(),
                targetExe,
                installDir,
                targetExe,
                AstroConstants.AppDescription);

            ShellHelpers.CreateShortcut(
                AstroConstants.GetStartMenuShortcutPath(),
                targetExe,
                installDir,
                targetExe,
                AstroConstants.AppDescription);
        }

        private static void LaunchInstalledApp(string installDir)
        {
            string exePath = Path.Combine(installDir, AstroConstants.MainExecutableName);
            if (!File.Exists(exePath))
            {
                throw new FileNotFoundException("ASTRO Launcher.exe wurde nach der Installation nicht gefunden.", exePath);
            }

            var psi = new ProcessStartInfo
            {
                FileName = exePath,
                WorkingDirectory = installDir,
                UseShellExecute = true
            };
            Process.Start(psi);
        }

        private static string FormatMegabytes(long bytes)
        {
            return string.Format("{0:0} MB", Math.Round(bytes / (1024.0 * 1024.0)));
        }

        private static void Report(
            Action<InstallProgress> reportProgress,
            double percent,
            string status,
            string detail,
            string sizeText)
        {
            reportProgress?.Invoke(new InstallProgress
            {
                Percent = percent,
                Status = status,
                Detail = detail,
                SizeText = sizeText
            });
        }
    }
}
