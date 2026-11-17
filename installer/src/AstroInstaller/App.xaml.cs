using System;
using System.Threading;
using System.Windows;
using AstroSetup.Common;

namespace AstroInstaller
{
    public partial class App : Application
    {
        private Mutex _singleInstanceMutex;

        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            bool createdNew;
            _singleInstanceMutex = new Mutex(true, AstroConstants.InstallerMutexName, out createdNew);
            if (!createdNew)
            {
                Shutdown(0);
                return;
            }

            bool silent = AstroUiHelpers.HasFlag(e.Args, "/S", "--silent");
            bool noLaunch = AstroUiHelpers.HasFlag(e.Args, "--no-launch", "/NOLAUNCH");

            if (silent)
            {
                try
                {
                    string version = AstroUiHelpers.GetCleanVersionText();
                    InstallerEngine.Install(version, !noLaunch, null, CancellationToken.None);
                    Shutdown(0);
                }
                catch
                {
                    Shutdown(1);
                }
                return;
            }

            var window = new MainWindow(!noLaunch);
            MainWindow = window;
            window.Closed += (s, args) => Shutdown(0);
            window.Show();
        }

        protected override void OnExit(ExitEventArgs e)
        {
            if (_singleInstanceMutex != null)
            {
                try
                {
                    _singleInstanceMutex.ReleaseMutex();
                }
                catch
                {
                    // Ignore if mutex was not owned.
                }
                _singleInstanceMutex.Dispose();
                _singleInstanceMutex = null;
            }

            base.OnExit(e);
        }
    }
}
