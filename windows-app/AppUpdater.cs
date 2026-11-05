using System.Diagnostics;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text.Json;

namespace CorpDesk;

internal static class AppUpdater
{
    private static bool checking;
    internal const string Repository = "pitchiluxe/corpdesk-it-support-lab";
    internal static async Task Check(Form owner, bool manual = false)
    {
        if (checking) return;
        checking = true;
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
            http.DefaultRequestHeaders.UserAgent.ParseAdd("CORPDesk/1.0.0");
            using var release = JsonDocument.Parse(await http.GetStringAsync($"https://api.github.com/repos/{Repository}/releases/latest"));
            var assets = release.RootElement.GetProperty("assets").EnumerateArray().ToArray();
            string Asset(string name) => assets.First(a => a.GetProperty("name").GetString() == name).GetProperty("browser_download_url").GetString()!;
            string Trusted(string url)
            {
                if (!url.StartsWith($"https://github.com/{Repository}/releases/download/", StringComparison.Ordinal)) throw new InvalidDataException("Unexpected update source.");
                return url;
            }
            using var manifest = JsonDocument.Parse(await http.GetStringAsync(Trusted(Asset("release.json"))));
            var info = manifest.RootElement;
            var version = Version.Parse(info.GetProperty("version").GetString()!);
            var current = typeof(AppUpdater).Assembly.GetName().Version!;
            if (version <= current) { if (manual) MessageBox.Show(owner, "You have the latest version.", "CORP Desk updates"); return; }
            var expected = info.GetProperty("sha256").GetString()!;
            if (expected.Length != 64 || !expected.All(Uri.IsHexDigit)) throw new InvalidDataException("Invalid update checksum.");
            var folder = Path.Combine(Program.DataRoot, "Updates", version.ToString());
            Directory.CreateDirectory(folder);
            var target = Path.Combine(folder, "CORP-Desk-Setup.exe");
            using (var response = await http.GetAsync(Trusted(Asset("CORP-Desk-Setup.exe")), HttpCompletionOption.ResponseHeadersRead))
            {
                response.EnsureSuccessStatusCode();
                await using var output = File.Create(target);
                await response.Content.CopyToAsync(output);
            }
            await using (var input = File.OpenRead(target))
            {
                var actual = Convert.ToHexString(await SHA256.HashDataAsync(input));
                if (!actual.Equals(expected, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Update checksum did not match. The installer will not run.");
            }
            if (owner.IsDisposed) return;
            if (MessageBox.Show(owner, $"CORP Desk {version} is downloaded and verified. Restart to install it now? Your saved lab data will be kept.", "Update ready", MessageBoxButtons.YesNo, MessageBoxIcon.Information) != DialogResult.Yes) return;
            Process.Start(new ProcessStartInfo(target, "/SILENT /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS") { UseShellExecute = true });
            owner.Close();
        }
        catch (Exception ex)
        {
            if (manual && !owner.IsDisposed) MessageBox.Show(owner, "Could not check for updates.\n\n" + ex.Message, "CORP Desk updates", MessageBoxButtons.OK, MessageBoxIcon.Information);
            // Offline or unpublished releases must never interrupt the training session.
        }
        finally { checking = false; }
    }
}
