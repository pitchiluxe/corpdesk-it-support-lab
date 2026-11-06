using System.Diagnostics;
using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using WinApp = System.Windows.Forms.Application;

namespace CorpDesk;

internal static class Program
{
    internal static string DataRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Pitchiluxe", "CorpDesk");
    [STAThread]
    private static void Main(string[] args)
    {
        if(args.Length==2 && args[0]=="--profile") DataRoot=Path.GetFullPath(args[1]);
        if (args.Length == 2 && args[0] == "--self-test")
        {
            try { SelfTest.Run(args[1]).GetAwaiter().GetResult(); Environment.ExitCode = 0; }
            catch (Exception ex) { File.WriteAllText(args[1], JsonSerializer.Serialize(new { ok = false, error = ex.Message })); Environment.ExitCode = 1; }
            return;
        }
        ApplicationConfiguration.Initialize();
        try
        {
            _ = CoreWebView2Environment.GetAvailableBrowserVersionString();
            Directory.CreateDirectory(DataRoot);
            using var host = new LocalServices();
            WinApp.Run(new LabWindow(host));
        }
        catch (WebView2RuntimeNotFoundException)
        {
            MessageBox.Show("CORP Desk needs Microsoft Edge WebView2 Runtime. Install the Evergreen Runtime from Microsoft, then open the app again.\n\nhttps://developer.microsoft.com/microsoft-edge/webview2/", "WebView2 Runtime required", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        catch (Exception ex) { MessageBox.Show("CORP Desk could not start.\n\n" + ex.Message, "CORP Desk", MessageBoxButtons.OK, MessageBoxIcon.Error); }
    }
    /// <summary>The build version (build.ps1 -Version), shown in Settings > About and sent with update checks.</summary>
    internal static string AppVersion => typeof(Program).Assembly.GetName().Version?.ToString(3) ?? "1.0.0";
    internal static Icon? GetIcon() { var file = Path.Combine(AppContext.BaseDirectory,"wwwroot","assets","corpdesk.ico"); return File.Exists(file) ? new Icon(file) : null; }
}

internal sealed class LabWindow : Form
{
    private const string NativeBootstrap = """
    window.corpDesktop={isNative:true,version:'{{VERSION}}'};
    (()=>{let sequence=0;const pending=new Map();
      window.corpNativeResult=(id,reply)=>{const callback=pending.get(id);if(callback){pending.delete(id);callback(reply);}};
      const originalFetch=window.fetch.bind(window);
      window.fetch=(input,options={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href);
        if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return originalFetch(input,options);
        return new Promise((resolve,reject)=>{const id=++sequence;const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('Native request timed out'));},90000);
          pending.set(id,reply=>{clearTimeout(timeout);resolve(new Response(JSON.stringify(reply.body),{status:reply.status,headers:{'Content-Type':'application/json'}}));});
          window.chrome.webview.postMessage({action:'apiRequest',id,path:url.pathname+url.search,body:options.body||null});});};
    })();
    """;
    private readonly LocalServices host;private readonly WebView2 web=new(){Dock=DockStyle.Fill};
    private readonly System.Windows.Forms.Timer poll=new(){Interval=15000};
    private readonly WebTabs tabs;private bool probing;private string? pendingOpen;
    internal LabWindow(LocalServices host)
    {
        this.host=host;Text="CORP Desk — IT Support Practice Lab";Icon=Program.GetIcon();Size=new Size(1380,900);MinimumSize=new Size(800,600);StartPosition=FormStartPosition.CenterScreen;
        // Ollama status, credit and update checks live in the lab's Settings app (dist/desktop.js).
        Controls.Add(web);tabs=new WebTabs(this,SendWeb);
        Shown+=async(_,_)=>{await Initialize();await AppUpdater.Check(this);};poll.Tick+=async(_,_)=>await UpdateOllama();FormClosed+=(_,_)=>{poll.Stop();poll.Dispose();tabs.Dispose();web.Dispose();};
    }
    private async Task Initialize()
    {
        try
        {
            var env=await CoreWebView2Environment.CreateAsync(null,Path.Combine(Program.DataRoot,"Profile"));await web.EnsureCoreWebView2Async(env);
            web.CoreWebView2.SetVirtualHostNameToFolderMapping("corpdesk.local",Path.Combine(AppContext.BaseDirectory,"wwwroot"),CoreWebView2HostResourceAccessKind.DenyCors);
            await web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(NativeBootstrap.Replace("{{VERSION}}",Program.AppVersion));
            web.CoreWebView2.WebMessageReceived+=async(_,e)=>
            {
                if(!e.Source.StartsWith(host.Origin+"/",StringComparison.Ordinal))return;
                try{using var json=JsonDocument.Parse(e.WebMessageAsJson);var data=json.RootElement;var action=data.GetProperty("action").GetString();
                    if(action=="webView")tabs.Apply(data);
                    else if(action=="webReload")tabs.Reload(data.GetProperty("tab").GetString());
                    else if(action=="labReady"&&pendingOpen!=null){var url=pendingOpen;pendingOpen=null;await SendWeb(JsonSerializer.Serialize(new{open=url}));}
                    else if(action=="openBrowser"){var url=data.TryGetProperty("url",out var u)?u.GetString():null;await OpenInLab(url??"https://www.google.com");}
                    else if(action=="probeOllama")await UpdateOllama();
                    else if(action=="checkUpdates")await AppUpdater.Check(this,true);
                    else if(action=="startOllama"){var installed=LocalServices.InstalledOllama();if(installed!=null)Process.Start(new ProcessStartInfo(installed){UseShellExecute=true});else MessageBox.Show(this,"Ollama was not found. Install it from ollama.com, download a local model, then retry.","Local Ollama",MessageBoxButtons.OK,MessageBoxIcon.Information);}
                    else if(action=="apiRequest"){var id=data.GetProperty("id").GetInt32();var path=data.GetProperty("path").GetString()??"";var payload=data.TryGetProperty("body",out var b)?b.GetString():null;var reply=await host.Request(path,payload);await web.CoreWebView2.ExecuteScriptAsync("window.corpNativeResult("+id+","+JsonSerializer.Serialize(reply)+");");}
                }catch(JsonException){}catch(KeyNotFoundException){}catch(Exception){}
            };
            // Website links on the app's own pages never leave the app: they open as tabs of the lab's Chrome window.
            web.CoreWebView2.NavigationStarting+=(_,e)=>{if(!e.Uri.StartsWith(host.Origin+"/",StringComparison.Ordinal)&&!e.Uri.StartsWith("about:",StringComparison.Ordinal)){e.Cancel=true;_=OpenInLab(e.Uri);}};
            web.CoreWebView2.NewWindowRequested+=(_,e)=>{e.Handled=true;_=OpenInLab(e.Uri);};
            // Screen Pen recordings may narrate with the microphone and show the camera bubble: ask, every time. Everything else stays denied.
            web.CoreWebView2.PermissionRequested+=(_,e)=>{
                if(e.PermissionKind is CoreWebView2PermissionKind.Microphone or CoreWebView2PermissionKind.Camera&&e.Uri.StartsWith(host.Origin+"/",StringComparison.Ordinal))
                    e.State=MessageBox.Show(this,"Screen Pen wants to use your "+(e.PermissionKind==CoreWebView2PermissionKind.Camera?"camera":"microphone")+" for a recording. Allow?","CORP Desk",MessageBoxButtons.YesNo,MessageBoxIcon.Question)==DialogResult.Yes?CoreWebView2PermissionState.Allow:CoreWebView2PermissionState.Deny;
                else e.State=CoreWebView2PermissionState.Deny;
            };
            // The taskbar's full-screen button (and F11): the window itself goes borderless and covers the screen, and comes back.
            FormBorderStyle savedBorder=FormBorderStyle;FormWindowState savedState=WindowState;
            web.CoreWebView2.ContainsFullScreenElementChanged+=(_,_)=>{
                if(web.CoreWebView2.ContainsFullScreenElement){savedBorder=FormBorderStyle;savedState=WindowState;FormBorderStyle=FormBorderStyle.None;WindowState=FormWindowState.Normal;WindowState=FormWindowState.Maximized;}
                else{FormBorderStyle=savedBorder;WindowState=savedState;}
            };
            web.CoreWebView2.NavigationCompleted+=async(_,_)=>await UpdateOllama();
            // The desktop app opens straight onto the workstation (lab.html); the landing page is for the website.
            web.Source=new Uri(host.Origin+"/lab.html");poll.Start();
        }catch(Exception ex){MessageBox.Show(this,"The desktop could not load.\n\n"+ex.Message,"CORP Desk",MessageBoxButtons.OK,MessageBoxIcon.Error);}
    }
    private async Task SendWeb(string detail)
    {
        if(web.CoreWebView2!=null&&!IsDisposed)await web.CoreWebView2.ExecuteScriptAsync("window.dispatchEvent(new CustomEvent('corp-web',{detail:"+detail+"}));");
    }
    private async Task OpenInLab(string url)
    {
        if(!Uri.TryCreate(url,UriKind.Absolute,out var target)||target.Scheme is not ("https" or "http"))return;
        if(web.Source?.AbsolutePath.EndsWith("/lab.html",StringComparison.OrdinalIgnoreCase)==true)await SendWeb(JsonSerializer.Serialize(new{open=target.AbsoluteUri}));
        else{pendingOpen=target.AbsoluteUri;web.Source=new Uri(host.Origin+"/lab.html");}
    }
    private async Task UpdateOllama()
    {
        if(probing||IsDisposed)return;probing=true;
        try{var data=await host.Probe();using var json=JsonDocument.Parse(JsonSerializer.Serialize(data));if(web.CoreWebView2!=null&&!IsDisposed)await web.CoreWebView2.ExecuteScriptAsync("window.dispatchEvent(new CustomEvent('corp-ollama',{detail:"+json.RootElement.GetRawText()+"}));");}catch{}finally{probing=false;}
    }
}

/// <summary>
/// Websites inside the lab's Chrome window. The page reports where its page area is on screen
/// (or that it is hidden behind another window, menu or dialog); each Chrome tab keeps its own
/// WebView2, laid exactly over that area, so switching tabs does not reload. Pop-ups load in the
/// same tab and only http(s) pages are allowed, so nothing opens outside the app.
/// </summary>
internal sealed class WebTabs : IDisposable
{
    private readonly Form owner;private readonly Func<string,Task> send;
    private readonly Dictionary<string,WebView2> views=new();private readonly HashSet<string> pageDriven=new();
    private readonly Task<CoreWebView2Environment> environment;
    internal WebTabs(Form owner,Func<string,Task> send){this.owner=owner;this.send=send;environment=CoreWebView2Environment.CreateAsync(null,Path.Combine(Program.DataRoot,"Browser"));}
    internal void Apply(JsonElement data)
    {
        var open=data.TryGetProperty("tabs",out var list)&&list.ValueKind==JsonValueKind.Array?list.EnumerateArray().Select(x=>x.GetString()??"").ToHashSet():new HashSet<string>();
        foreach(var id in views.Keys.Where(id=>!open.Contains(id)).ToList()){views[id].Dispose();views.Remove(id);pageDriven.Remove(id);}
        var tab=data.TryGetProperty("visible",out var shown)&&shown.GetBoolean()?data.GetProperty("tab").GetString():null;
        foreach(var (id,other) in views)if(id!=tab)other.Visible=false;
        if(tab==null||!Uri.TryCreate(data.GetProperty("url").GetString(),UriKind.Absolute,out var target)||target.Scheme is not ("https" or "http"))return;
        if(!views.TryGetValue(tab,out var view)){view=new WebView2{Visible=false};views[tab]=view;owner.Controls.Add(view);_=Start(tab,view,target.AbsoluteUri);}
        view.Bounds=new Rectangle(data.GetProperty("x").GetInt32(),data.GetProperty("y").GetInt32(),data.GetProperty("w").GetInt32(),data.GetProperty("h").GetInt32());
        view.Visible=true;view.BringToFront();
        if(view.CoreWebView2!=null&&view.Source?.AbsoluteUri!=target.AbsoluteUri){pageDriven.Add(tab);view.CoreWebView2.Navigate(target.AbsoluteUri);}
    }
    internal void Reload(string? tab){if(tab!=null&&views.TryGetValue(tab,out var view))view.CoreWebView2?.Reload();}
    private async Task Start(string tab,WebView2 view,string url)
    {
        try
        {
            await view.EnsureCoreWebView2Async(await environment);if(view.IsDisposed)return;
            var core=view.CoreWebView2;core.Settings.IsWebMessageEnabled=false;
            core.NavigationStarting+=(_,e)=>{if(!Uri.TryCreate(e.Uri,UriKind.Absolute,out var u)||u.Scheme is not ("https" or "http" or "about"))e.Cancel=true;};
            core.NewWindowRequested+=(_,e)=>{e.Handled=true;if(Uri.TryCreate(e.Uri,UriKind.Absolute,out var u)&&u.Scheme is "https" or "http")core.Navigate(u.AbsoluteUri);};
            // Address changes go back to the page's tab, which keeps the history; loads the page asked for replace the entry.
            core.SourceChanged+=(_,_)=>_=send(JsonSerializer.Serialize(new{tab,url=core.Source,replace=pageDriven.Contains(tab)}));
            core.NavigationCompleted+=(_,_)=>pageDriven.Remove(tab);
            core.DocumentTitleChanged+=(_,_)=>_=send(JsonSerializer.Serialize(new{tab,title=core.DocumentTitle}));
            core.PermissionRequested+=(_,e)=>{e.State=MessageBox.Show(owner,new Uri(e.Uri).Host+" requests "+e.PermissionKind+". Allow?","Website permission",MessageBoxButtons.YesNo,MessageBoxIcon.Question)==DialogResult.Yes?CoreWebView2PermissionState.Allow:CoreWebView2PermissionState.Deny;};
            pageDriven.Add(tab);core.Navigate(url);
        }catch(Exception ex){if(!view.IsDisposed)MessageBox.Show(owner,ex.Message,"Browser",MessageBoxButtons.OK,MessageBoxIcon.Error);}
    }
    internal static string? NormalizeAddress(string input)
    {
        input=input.Trim();if(input.Length==0)return null;if(Uri.TryCreate(input,UriKind.Absolute,out var url)&&url.Scheme is "http" or "https")return url.AbsoluteUri;
        if(!input.Any(char.IsWhiteSpace)&&input.Contains('.')&&!input.Contains("://")&&Uri.TryCreate("https://"+input,UriKind.Absolute,out url))return url.AbsoluteUri;
        return "https://www.google.com/search?q="+Uri.EscapeDataString(input);
    }
    public void Dispose(){foreach(var view in views.Values)view.Dispose();views.Clear();}
}

internal static class SelfTest
{
    internal static async Task Run(string report)
    {
        using var host=new LocalServices();var root=Path.Combine(AppContext.BaseDirectory,"wwwroot");
        var files=new[]{"index.html","lab.html","landing.css","landing.js","native-bridge.js","assets/corpdesk.ico"}.ToDictionary(file=>file,file=>File.Exists(Path.Combine(root,file)));
        var version=CoreWebView2Environment.GetAvailableBrowserVersionString();var ollama=await host.Probe();
        var ok=files.Values.All(v=>v)&&WebTabs.NormalizeAddress("www.google.com")=="https://www.google.com/"&&WebTabs.NormalizeAddress("money")=="https://www.google.com/search?q=money";
        File.WriteAllText(report,JsonSerializer.Serialize(new{ok,files,webView2Runtime=version,ollama,contentLoading="WebView2 virtual host; no local TCP server",checkedAt=DateTimeOffset.Now},new JsonSerializerOptions{WriteIndented=true}));if(!ok)throw new Exception("Desktop smoke checks failed.");
    }
}
