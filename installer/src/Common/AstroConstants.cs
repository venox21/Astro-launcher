using System;
using System.IO;

namespace AstroSetup.Common
{
    internal static class AstroConstants
    {
        public const string AppDisplayName = "ASTRO Launcher";
        public const string AppPublisher = "ASTRO";
        public const string AppDescription = "ASTRO FiveM Launcher";
        public const string MainExecutableName = "ASTRO Launcher.exe";
        public const string UninstallerExecutableName = "Uninstall ASTRO Launcher.exe";
        public const string ShortcutFileName = "ASTRO Launcher.lnk";
        public const string UninstallRegistryKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\AstroLauncher";
        public const string InstallerMutexName = @"Local\AstroLauncherSetupMutex";
        public const string PayloadResourceName = "AstroInstaller.payload.zip";
        public const string LogoResourceSuffix = "astro-logo-256.png";

        public static string GetDefaultInstallDirectory()
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            return Path.Combine(localAppData, "Programs", AppDisplayName);
        }

        public static string GetDesktopShortcutPath()
        {
            string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            return Path.Combine(desktop, ShortcutFileName);
        }

        public static string GetStartMenuShortcutPath()
        {
            string programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
            return Path.Combine(programs, ShortcutFileName);
        }
    }
}
