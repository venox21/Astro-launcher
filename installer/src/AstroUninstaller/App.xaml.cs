using System;
using System.Windows;
using AstroSetup.Common;

namespace AstroUninstaller
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            bool silent = AstroUiHelpers.HasFlag(e.Args, "/S", "--silent");
            if (silent)
            {
                try
                {
                    string targetDir = UninstallerEngine.ResolveTargetDirectory();
                    if (targetDir != null)
                    {
                        UninstallerEngine.Uninstall(targetDir, null);
                    }
                    Shutdown(0);
                }
                catch
                {
                    Shutdown(1);
                }
                return;
            }

            var window = new MainWindow();
            MainWindow = window;
            window.Closed += (s, args) => Shutdown();
            window.Show();
        }
    }
}
