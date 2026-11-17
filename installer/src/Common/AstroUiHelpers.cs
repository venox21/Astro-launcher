using System;
using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Media.Imaging;

namespace AstroSetup.Common
{
    internal static class AstroUiHelpers
    {
        public static BitmapImage LoadEmbeddedLogo()
        {
            Assembly assembly = Assembly.GetExecutingAssembly();
            string[] names = assembly.GetManifestResourceNames();
            foreach (string name in names)
            {
                if (name.EndsWith(AstroConstants.LogoResourceSuffix, StringComparison.OrdinalIgnoreCase))
                {
                    using (Stream stream = assembly.GetManifestResourceStream(name))
                    {
                        if (stream == null)
                        {
                            return null;
                        }

                        var bitmap = new BitmapImage();
                        bitmap.BeginInit();
                        bitmap.CacheOption = BitmapCacheOption.OnLoad;
                        bitmap.StreamSource = stream;
                        bitmap.EndInit();
                        bitmap.Freeze();
                        return bitmap;
                    }
                }
            }

            return null;
        }

        public static string GetCleanVersionText()
        {
            Assembly assembly = Assembly.GetExecutingAssembly();
            var infoAttr = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>();
            if (infoAttr != null && !string.IsNullOrWhiteSpace(infoAttr.InformationalVersion))
            {
                string raw = infoAttr.InformationalVersion.Trim();
                int plusIndex = raw.IndexOf('+');
                if (plusIndex > 0)
                {
                    raw = raw.Substring(0, plusIndex);
                }

                return raw.StartsWith("v", StringComparison.OrdinalIgnoreCase) ? raw.Substring(1) : raw;
            }

            Version ver = assembly.GetName().Version;
            return ver != null ? string.Format("{0}.{1}.{2}", ver.Major, ver.Minor, ver.Build) : "1.0.0";
        }

        public static bool HasFlag(string[] args, string shortFlag, string longFlag)
        {
            if (args == null)
            {
                return false;
            }

            foreach (string arg in args)
            {
                if (string.Equals(arg, shortFlag, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(arg, longFlag, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }

        public static void EnableWindowDrag(Window window)
        {
            window.MouseLeftButtonDown += (sender, e) =>
            {
                if (e.LeftButton == System.Windows.Input.MouseButtonState.Pressed)
                {
                    window.DragMove();
                }
            };
        }
    }
}
