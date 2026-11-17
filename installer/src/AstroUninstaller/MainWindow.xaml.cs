using System;
using System.Threading.Tasks;
using System.Windows;
using AstroSetup.Common;

namespace AstroUninstaller
{
    public partial class MainWindow : Window
    {
        private readonly string _targetDir;
        private bool _isRunning;
        private bool _isCompleted;

        public MainWindow()
        {
            InitializeComponent();
            AstroUiHelpers.EnableWindowDrag(this);
            LogoImage.Source = AstroUiHelpers.LoadEmbeddedLogo();

            _targetDir = UninstallerEngine.ResolveTargetDirectory();
            if (_targetDir == null)
            {
                TitleText.Text = "Keine Installation gefunden";
                MessageText.Text = "Es wurde keine gültige ASTRO Launcher Installation auf diesem System gefunden.";
                PathText.Text = string.Empty;
                UninstallButton.Visibility = Visibility.Collapsed;
                CancelButton.Content = "Schließen";
            }
            else
            {
                PathText.Text = _targetDir;
            }
        }

        private async void UninstallButton_Click(object sender, RoutedEventArgs e)
        {
            if (_isRunning || _isCompleted || _targetDir == null)
            {
                if (_isCompleted)
                {
                    Close();
                }
                return;
            }

            _isRunning = true;
            UninstallButton.IsEnabled = false;
            CancelButton.IsEnabled = false;
            CloseButton.IsEnabled = false;
            TitleText.Text = "Deinstallation läuft …";

            try
            {
                await Task.Run(() =>
                {
                    UninstallerEngine.Uninstall(_targetDir, status =>
                    {
                        Dispatcher.Invoke(() => MessageText.Text = status);
                    });
                });

                _isCompleted = true;
                TitleText.Text = "ASTRO Launcher entfernt";
                MessageText.Text = "Der Launcher und alle Verknüpfungen wurden vollständig entfernt.";
                PathText.Text = string.Empty;
                UninstallButton.Visibility = Visibility.Collapsed;
                CancelButton.Content = "Schließen";
                CancelButton.IsEnabled = true;
                CloseButton.IsEnabled = true;

                await Task.Delay(1200);
                Close();
            }
            catch (Exception ex)
            {
                _isRunning = false;
                TitleText.Text = "Deinstallation fehlgeschlagen";
                MessageText.Text = ex.Message;
                UninstallButton.IsEnabled = true;
                CancelButton.IsEnabled = true;
                CloseButton.IsEnabled = true;
            }
        }

        private void CloseButton_Click(object sender, RoutedEventArgs e)
        {
            if (!_isRunning)
            {
                Close();
            }
        }
    }
}
