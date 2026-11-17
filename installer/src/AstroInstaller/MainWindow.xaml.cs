using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using AstroSetup.Common;

namespace AstroInstaller
{
    public partial class MainWindow : Window
    {
        private readonly bool _launchAfterInstall;
        private readonly string _version;
        private CancellationTokenSource _cts;
        private bool _isInstalling;

        public MainWindow(bool launchAfterInstall)
        {
            InitializeComponent();
            _launchAfterInstall = launchAfterInstall;
            _version = AstroUiHelpers.GetCleanVersionText();

            AstroUiHelpers.EnableWindowDrag(this);
            LogoImage.Source = AstroUiHelpers.LoadEmbeddedLogo();
            VersionBadgeText.Text = "v" + _version;

            Loaded += MainWindow_Loaded;
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            await RunInstallAsync();
        }

        private async Task RunInstallAsync()
        {
            if (_isInstalling)
            {
                return;
            }

            _isInstalling = true;
            _cts = new CancellationTokenSource();

            ErrorPanel.Visibility = Visibility.Collapsed;
            ProgressPanel.Visibility = Visibility.Visible;
            FooterHintText.Visibility = Visibility.Visible;
            CloseButton.IsEnabled = true;

            try
            {
                CancellationToken token = _cts.Token;
                await Task.Run(() =>
                {
                    InstallerEngine.Install(
                        _version,
                        _launchAfterInstall,
                        progress =>
                        {
                            Dispatcher.BeginInvoke(new Action(() =>
                            {
                                InstallProgressBar.Value = progress.Percent;
                                PercentText.Text = string.Format("{0:0}%", progress.Percent);
                                StatusText.Text = progress.Status;
                                DetailText.Text = progress.Detail;
                                SizeText.Text = progress.SizeText;

                                if (progress.Percent >= 97)
                                {
                                    CloseButton.IsEnabled = false;
                                }
                            }));
                        },
                        token);
                }, token);

                _isInstalling = false;
                await Task.Delay(450);
                Close();
            }
            catch (OperationCanceledException)
            {
                _isInstalling = false;
                Close();
            }
            catch (Exception ex)
            {
                _isInstalling = false;
                CloseButton.IsEnabled = true;
                ProgressPanel.Visibility = Visibility.Collapsed;
                FooterHintText.Visibility = Visibility.Collapsed;
                ErrorMessageText.Text = ex.Message;
                ErrorPanel.Visibility = Visibility.Visible;
            }
            finally
            {
                if (_cts != null)
                {
                    _cts.Dispose();
                    _cts = null;
                }
            }
        }

        private async void RetryButton_Click(object sender, RoutedEventArgs e)
        {
            await RunInstallAsync();
        }

        private void CloseButton_Click(object sender, RoutedEventArgs e)
        {
            if (_isInstalling && _cts != null)
            {
                CloseButton.IsEnabled = false;
                StatusText.Text = "Wird abgebrochen …";
                _cts.Cancel();
                return;
            }

            Close();
        }
    }
}
