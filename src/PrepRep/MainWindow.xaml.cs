using System.IO;
using System.Text.Json;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace PrepRep;

/// <summary>
/// One WebView2 showing web/index.html from a private host name (no web server, no open port).
/// The page sends {id, type, payload}; the engine answers {id, result}. Streamed pieces go as {id, partial}.
/// </summary>
public partial class MainWindow : Window
{
    private readonly Engine _engine = new();
    private bool _full;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += async (_, _) => await StartAsync();
    }

    private async Task StartAsync()
    {
        try
        {
            string web = Engine.UnpackWeb();
            var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Engine.DataDir, "WebView2"));
            await Web.EnsureCoreWebView2Async(env);
            var core = Web.CoreWebView2;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.SetVirtualHostNameToFolderMapping("app.local", web, CoreWebView2HostResourceAccessKind.Allow);
            core.WebMessageReceived += OnMessage;
            core.NewWindowRequested += (_, a) =>
            {
                a.Handled = true;   // links to other sites open in the normal browser
                try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(a.Uri) { UseShellExecute = true }); } catch { }
            };
            Web.KeyDown += (_, k) => { if (k.Key == System.Windows.Input.Key.F11) ToggleFullScreen(); };
            core.Navigate("https://app.local/index.html");
            Loading.Visibility = Visibility.Collapsed;
        }
        catch (WebView2RuntimeNotFoundException)
        {
            Loading.Text = "PrepRep needs the Microsoft Edge WebView2 Runtime (built into Windows 11).";
        }
        catch (Exception ex)
        {
            Loading.Text = "PrepRep couldn't start: " + ex.Message;
        }
    }

    private void ToggleFullScreen()
    {
        _full = !_full;
        WindowStyle = _full ? WindowStyle.None : WindowStyle.SingleBorderWindow;
        WindowState = WindowState.Normal;
        WindowState = WindowState.Maximized;
    }

    private async void OnMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string id = "";
        object result;
        try
        {
            using var doc = JsonDocument.Parse(e.WebMessageAsJson);
            var root = doc.RootElement;
            id = root.GetProperty("id").GetString() ?? "";
            string type = root.GetProperty("type").GetString() ?? "";
            var payload = root.TryGetProperty("payload", out var p) ? p.Clone() : default;
            string myId = id;
            result = await _engine.HandleAsync(type, payload, text => Dispatcher.InvokeAsync(() =>
            {
                try { Web.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new Dictionary<string, object?> { ["id"] = myId, ["partial"] = text })); } catch { }
            }));
        }
        catch (Exception ex)
        {
            result = new Dictionary<string, object?> { ["error"] = ex.Message };
        }
        try { Web.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new Dictionary<string, object?> { ["id"] = id, ["result"] = result })); }
        catch { /* window closing */ }
    }
}
