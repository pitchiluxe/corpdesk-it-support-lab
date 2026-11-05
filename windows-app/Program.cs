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
    internal static Icon? GetIcon() { var file = Path.Combine(AppContext.BaseDirectory,"wwwroot","assets","corpdesk.ico"); return File.Exists(file) ? new Icon(file) : null; }
}

internal sealed class LabWindow : Form
{
    private const string NativeBootstrap = """
    window.corpDesktop={isNative:true,version:'1.0.0'};
    (()=>{let sequence=0;const pending=new Map();
      window.corpNativeResult=(id,reply)=>{const callback=pending.get(id);if(callback){pending.delete(id);callback(reply);}};
      const originalFetch=window.fetch.bind(window);
      window.fetch=(input,options={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href);
        if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return originalFetch(input,options);
        return new Promise((resolve,reject)=>{const id=++sequence;const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('Native request timed out'));},90000);
          pending.set(id,reply=>{clearTimeout(timeout);resolve(new Response(JSON.stringify(reply.body),{status:reply.status,headers:{'Content-Type':'application/json'}}));});
          window.chrome.webview.postMessage({action:'apiRequest',id,path:url.pathname,body:options.body||null});});};
    })();
    """;
    private readonly LocalServices host;private readonly WebView2 web=new(){Dock=DockStyle.Fill};
    private readonly System.Windows.Forms.Timer poll=new(){Interval=15000};
    private BrowserWindow? browser;private bool probing;
    internal LabWindow(LocalServices host)
    {
        this.host=host;Text="CORP Desk — IT Support Practice Lab";Icon=Program.GetIcon();Size=new Size(1380,900);MinimumSize=new Size(800,600);StartPosition=FormStartPosition.CenterScreen;
        // Ollama status, credit and update checks live in the lab's Settings app (dist/desktop.js).
        Controls.Add(web);
        Shown+=async(_,_)=>{await Initialize();await AppUpdater.Check(this);};poll.Tick+=async(_,_)=>await UpdateOllama();FormClosed+=(_,_)=>{poll.Stop();poll.Dispose();browser?.Dispose();web.Dispose();};
    }
    private async Task Initialize()
    {
        try
        {
            var env=await CoreWebView2Environment.CreateAsync(null,Path.Combine(Program.DataRoot,"Profile"));await web.EnsureCoreWebView2Async(env);
            web.CoreWebView2.SetVirtualHostNameToFolderMapping("corpdesk.local",Path.Combine(AppContext.BaseDirectory,"wwwroot"),CoreWebView2HostResourceAccessKind.DenyCors);
            await web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(NativeBootstrap);
            web.CoreWebView2.WebMessageReceived+=async(_,e)=>
            {
                if(!e.Source.StartsWith(host.Origin+"/",StringComparison.Ordinal))return;
                try{using var json=JsonDocument.Parse(e.WebMessageAsJson);var data=json.RootElement;var action=data.GetProperty("action").GetString();
                    if(action=="openBrowser"){var url=data.TryGetProperty("url",out var u)?u.GetString():null;OpenBrowser(url??"https://www.google.com");}
                    else if(action=="probeOllama")await UpdateOllama();
                    else if(action=="checkUpdates")await AppUpdater.Check(this,true);
                    else if(action=="startOllama"){var installed=LocalServices.InstalledOllama();if(installed!=null)Process.Start(new ProcessStartInfo(installed){UseShellExecute=true});else MessageBox.Show(this,"Ollama was not found. Install it from ollama.com, download a local model, then retry.","Local Ollama",MessageBoxButtons.OK,MessageBoxIcon.Information);}
                    else if(action=="apiRequest"){var id=data.GetProperty("id").GetInt32();var path=data.GetProperty("path").GetString()??"";var payload=data.TryGetProperty("body",out var b)?b.GetString():null;var reply=await host.Request(path,payload);await web.CoreWebView2.ExecuteScriptAsync("window.corpNativeResult("+id+","+JsonSerializer.Serialize(reply)+");");}
                }catch(JsonException){}catch(KeyNotFoundException){}catch(Exception){}
            };
            web.CoreWebView2.NavigationStarting+=(_,e)=>{if(!e.Uri.StartsWith(host.Origin+"/",StringComparison.Ordinal)&&!e.Uri.StartsWith("about:",StringComparison.Ordinal)){e.Cancel=true;if(Uri.TryCreate(e.Uri,UriKind.Absolute,out var u)&&u.Scheme is "https" or "http")OpenBrowser(e.Uri);}};
            web.CoreWebView2.NewWindowRequested+=(_,e)=>{e.Handled=true;OpenBrowser(e.Uri);};
            web.CoreWebView2.PermissionRequested+=(_,e)=>e.State=CoreWebView2PermissionState.Deny;
            web.CoreWebView2.NavigationCompleted+=async(_,_)=>await UpdateOllama();
            web.Source=new Uri(host.Origin+"/index.html");poll.Start();
        }catch(Exception ex){MessageBox.Show(this,"The desktop could not load.\n\n"+ex.Message,"CORP Desk",MessageBoxButtons.OK,MessageBoxIcon.Error);}
    }
    private void OpenBrowser(string url)
    {
        if(browser==null||browser.IsDisposed)
        {
            browser=new BrowserWindow{TopLevel=false,ShowInTaskbar=false,StartPosition=FormStartPosition.Manual,FormBorderStyle=FormBorderStyle.Sizable};
            var width=Math.Min(1140,ClientSize.Width-60);var height=Math.Min(750,ClientSize.Height-80);
            browser.Bounds=new Rectangle(Math.Max(8,(ClientSize.Width-width)/2),Math.Max(8,(ClientSize.Height-height)/2-10),width,height);
            Controls.Add(browser);browser.Show();
        }
        if(browser.WindowState==FormWindowState.Minimized)browser.WindowState=FormWindowState.Normal;
        _=browser.Open(url);browser.BringToFront();
    }
    private async Task UpdateOllama()
    {
        if(probing||IsDisposed)return;probing=true;
        try{var data=await host.Probe();using var json=JsonDocument.Parse(JsonSerializer.Serialize(data));if(web.CoreWebView2!=null&&!IsDisposed)await web.CoreWebView2.ExecuteScriptAsync("window.dispatchEvent(new CustomEvent('corp-ollama',{detail:"+json.RootElement.GetRawText()+"}));");}catch{}finally{probing=false;}
    }
}

internal sealed class BrowserWindow : Form
{
    private readonly TabControl tabs=new(){Dock=DockStyle.Fill};private readonly TextBox address=new(){Dock=DockStyle.Fill,Font=new Font("Segoe UI",11),BorderStyle=BorderStyle.FixedSingle};
    private readonly ToolStripStatusLabel status=new("Chromium / Microsoft Edge WebView2");
    private readonly Task<CoreWebView2Environment> environment;private bool firstShown;
    internal BrowserWindow()
    {
        Text="CORP Desk Browser";Icon=Program.GetIcon();Size=new Size(1180,800);MinimumSize=new Size(650,480);StartPosition=FormStartPosition.CenterScreen;Font=new Font("Segoe UI",10);
        environment=CoreWebView2Environment.CreateAsync(null,Path.Combine(Program.DataRoot,"Browser"));
        var bar=new TableLayoutPanel{Dock=DockStyle.Top,Height=44,ColumnCount=8,Padding=new Padding(7,6,7,6),BackColor=Color.FromArgb(239,243,248)};
        foreach(var width in new[]{36,36,36})bar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,width));bar.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));foreach(var width in new[]{42,36,36,42})bar.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,width));
        Button Button(string text,Action action){var b=new Button{Text=text,Dock=DockStyle.Fill,FlatStyle=FlatStyle.Flat,Margin=new Padding(2,0,2,0)};b.FlatAppearance.BorderSize=0;b.Click+=(_,_)=>action();return b;}
        bar.Controls.Add(Button("←",()=>{if(Current?.CoreWebView2?.CanGoBack==true)Current.GoBack();}),0,0);bar.Controls.Add(Button("→",()=>{if(Current?.CoreWebView2?.CanGoForward==true)Current.GoForward();}),1,0);bar.Controls.Add(Button("⟳",()=>Current?.Reload()),2,0);bar.Controls.Add(address,3,0);bar.Controls.Add(Button("Go",()=>NavigateAddress()),4,0);bar.Controls.Add(Button("+",()=>_ = Open("https://www.google.com")),5,0);bar.Controls.Add(Button("×",CloseTab),6,0);bar.Controls.Add(Button("↗",()=>{if(Current?.Source is Uri u)Process.Start(new ProcessStartInfo(u.AbsoluteUri){UseShellExecute=true});}),7,0);
        var strip=new StatusStrip{SizingGrip=false};strip.Items.Add(status);Controls.Add(tabs);Controls.Add(bar);Controls.Add(strip);address.KeyDown+=(_,e)=>{if(e.KeyCode==Keys.Enter){e.SuppressKeyPress=true;NavigateAddress();}};
        tabs.SelectedIndexChanged+=(_,_)=>{if(Current?.Source!=null)address.Text=Current.Source.AbsoluteUri;};KeyPreview=true;KeyDown+=HandleKeys;
        var context=new ContextMenuStrip();context.Items.Add("New tab",null,(_,_)=>_ = Open("https://www.google.com"));context.Items.Add("Close tab",null,(_,_)=>CloseTab());tabs.ContextMenuStrip=context;
    }
    private WebView2? Current=>tabs.SelectedTab?.Controls.OfType<WebView2>().FirstOrDefault();
    private void NavigateAddress(){var url=NormalizeAddress(address.Text);if(url!=null&&Current!=null)Current.Source=new Uri(url);}
    internal static string? NormalizeAddress(string input)
    {
        input=input.Trim();if(input.Length==0)return null;if(Uri.TryCreate(input,UriKind.Absolute,out var url)&&url.Scheme is "http" or "https")return url.AbsoluteUri;
        if(!input.Any(char.IsWhiteSpace)&&input.Contains('.')&&!input.Contains("://")&&Uri.TryCreate("https://"+input,UriKind.Absolute,out url))return url.AbsoluteUri;
        return "https://www.google.com/search?q="+Uri.EscapeDataString(input);
    }
    internal async Task Open(string url)
    {
        var target=NormalizeAddress(url);if(target==null)return;var page=new TabPage("Loading…");var view=new WebView2{Dock=DockStyle.Fill};page.Controls.Add(view);tabs.TabPages.Add(page);tabs.SelectedTab=page;
        try
        {
            await view.EnsureCoreWebView2Async(await environment);view.CoreWebView2.Settings.IsWebMessageEnabled=false;
            view.CoreWebView2.DocumentTitleChanged+=(_,_)=>{var title=view.CoreWebView2.DocumentTitle;page.Text=title.Length>28?title[..28]+"…":title;Text=(title.Length>0?title+" — ":"")+"CORP Desk Browser";};
            view.CoreWebView2.SourceChanged+=(_,_)=>{if(Current==view)address.Text=view.Source?.AbsoluteUri??"";};
            view.CoreWebView2.NewWindowRequested+=(_,e)=>{e.Handled=true;_ = Open(e.Uri);};
            view.CoreWebView2.NavigationStarting+=(_,e)=>{if(!Uri.TryCreate(e.Uri,UriKind.Absolute,out var u)||u.Scheme is not ("https" or "http" or "about"))e.Cancel=true;};
            view.CoreWebView2.PermissionRequested+=(_,e)=>{e.State=MessageBox.Show(this,new Uri(e.Uri).Host+" requests "+e.PermissionKind+". Allow?","Website permission",MessageBoxButtons.YesNo,MessageBoxIcon.Question)==DialogResult.Yes?CoreWebView2PermissionState.Allow:CoreWebView2PermissionState.Deny;};
            view.CoreWebView2.NavigationCompleted+=(_,e)=>{status.Text=e.IsSuccess?"Chromium / Microsoft Edge WebView2 · "+(view.Source?.Host??""):"Navigation failed: "+e.WebErrorStatus;};
            view.Source=new Uri(target);if(!firstShown){firstShown=true;address.Text=target;}
        }catch(Exception ex){page.Text="Unable to load";MessageBox.Show(this,ex.Message,"Browser",MessageBoxButtons.OK,MessageBoxIcon.Error);}
    }
    private void CloseTab(){var selected=tabs.SelectedTab;if(selected==null)return;foreach(Control c in selected.Controls)c.Dispose();tabs.TabPages.Remove(selected);selected.Dispose();if(tabs.TabPages.Count==0)Close();}
    private void HandleKeys(object? sender,KeyEventArgs e){if(e.Control&&e.KeyCode==Keys.L){e.SuppressKeyPress=true;address.Focus();address.SelectAll();}if(e.Control&&e.KeyCode==Keys.T){e.SuppressKeyPress=true;_ = Open("https://www.google.com");}if(e.Control&&e.KeyCode==Keys.W){e.SuppressKeyPress=true;CloseTab();}if(e.KeyCode==Keys.F5){e.SuppressKeyPress=true;Current?.Reload();}if(e.Alt&&e.KeyCode==Keys.Left&&Current?.CanGoBack==true){e.SuppressKeyPress=true;Current.GoBack();}}
}

internal static class SelfTest
{
    internal static async Task Run(string report)
    {
        using var host=new LocalServices();var root=Path.Combine(AppContext.BaseDirectory,"wwwroot");
        var files=new[]{"index.html","lab.html","landing.css","landing.js","native-bridge.js","assets/corpdesk.ico"}.ToDictionary(file=>file,file=>File.Exists(Path.Combine(root,file)));
        var version=CoreWebView2Environment.GetAvailableBrowserVersionString();var ollama=await host.Probe();
        var ok=files.Values.All(v=>v)&&BrowserWindow.NormalizeAddress("www.google.com")=="https://www.google.com/"&&BrowserWindow.NormalizeAddress("money")=="https://www.google.com/search?q=money";
        File.WriteAllText(report,JsonSerializer.Serialize(new{ok,files,webView2Runtime=version,ollama,contentLoading="WebView2 virtual host; no local TCP server",checkedAt=DateTimeOffset.Now},new JsonSerializerOptions{WriteIndented=true}));if(!ok)throw new Exception("Desktop smoke checks failed.");
    }
}
