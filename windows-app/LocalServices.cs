using System.Text.Json;
using System.Net.Http.Json;

namespace CorpDesk;

// Native IPC serves local-model requests. The app's HTML uses WebView2 virtual-host mapping,
// so the installed desktop never needs a loopback web server or a free TCP port.
internal sealed class LocalServices : IDisposable
{
    public const string NativeOrigin="https://corpdesk.local";
    public string Origin=>NativeOrigin;
    private readonly HttpClient client=new(new HttpClientHandler{UseProxy=false}){Timeout=TimeSpan.FromSeconds(85)};
    internal record Model(string name);
    internal record Reply(int status,object body);
    internal async Task<Model[]> Models()
    {
        using var timeout=new CancellationTokenSource(TimeSpan.FromSeconds(4));
        using var response=await client.GetAsync("http://127.0.0.1:11434/api/tags",timeout.Token);response.EnsureSuccessStatusCode();
        using var json=JsonDocument.Parse(await response.Content.ReadAsStringAsync(timeout.Token));
        return json.RootElement.GetProperty("models").EnumerateArray().Select(m=>new Model(m.GetProperty("name").GetString()??"")).Where(m=>!m.name.Contains("cloud",StringComparison.OrdinalIgnoreCase)).ToArray();
    }
    internal static string? InstalledOllama()=>new[]{Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","Ollama","ollama app.exe"),Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Ollama","ollama app.exe")}.FirstOrDefault(File.Exists);
    internal async Task<object> Probe(){try{return new{available=true,installed=true,models=await Models(),endpoint="127.0.0.1:11434"};}catch{return new{available=false,installed=InstalledOllama()!=null,models=Array.Empty<Model>(),endpoint="127.0.0.1:11434"};}}
    internal async Task<Reply> Request(string path,string? payload)
    {
        try
        {
            if(path.StartsWith("/api/yt-search?",StringComparison.Ordinal)||path=="/api/yt-search")return await YouTubeSearch(QueryValue(path,"q"));
            if(path=="/api/probe")return new(200,await Probe());
            if(path=="/api/models")return new(200,new{models=await Models()});
            if(path!="/api/chat")return new(404,new{error="Unknown native API route."});
            if(payload==null||payload.Length>65536)return new(400,new{error="Invalid chat payload."});
            using var json=JsonDocument.Parse(payload);var data=json.RootElement;var model=data.GetProperty("model").GetString()??"";
            if(model.Length>121||model.Contains("cloud",StringComparison.OrdinalIgnoreCase))return new(400,new{error="Choose a downloaded local model."});
            if(!(await Models()).Any(m=>m.name==model))return new(400,new{error="Selected model is not downloaded locally."});
            var messages=data.GetProperty("messages");if(messages.ValueKind!=JsonValueKind.Array||messages.GetArrayLength()<1||messages.GetArrayLength()>20)return new(400,new{error="Invalid message list."});
            var list=new List<object>();foreach(var m in messages.EnumerateArray()){var role=m.GetProperty("role").GetString();var content=m.GetProperty("content").GetString();if(role is not("user" or "assistant" or "system")||content==null||content.Length>9000)return new(400,new{error="Invalid message."});list.Add(new{role,content});}
            bool tickets=data.TryGetProperty("task",out var task)&&task.GetString()=="tickets";
            var body=new Dictionary<string,object>{{"model",model},{"messages",list},{"stream",false},{"options",new{num_ctx=4096,temperature=tickets?0.8:0.2,num_predict=tickets?2500:1200}}};if(tickets)body["format"]="json";
            using var response=await client.PostAsJsonAsync("http://127.0.0.1:11434/api/chat",body);
            if(!response.IsSuccessStatusCode)return new(502,new{error="Local Ollama request failed."});
            using var answer=JsonDocument.Parse(await response.Content.ReadAsStringAsync());return new(200,new{message=new{role="assistant",content=answer.RootElement.GetProperty("message").GetProperty("content").GetString()??""}});
        }
        catch(JsonException){return new(400,new{error="Invalid chat JSON."});}
        catch(KeyNotFoundException){return new(400,new{error="Missing chat fields."});}
        catch{return new(503,new{error="Local Ollama is unavailable. Start Ollama and choose a downloaded model."});}
    }
    // ------------------------------------------------------------ Jam: YouTube search without an API key
    // The same approach as ytsearch.cjs (ported from AIHub DJ): read the result list YouTube embeds in
    // its own search page as `ytInitialData`. Scraping breaks, so every step fails soft to fewer results.
    private readonly HttpClient youtube=new(new HttpClientHandler{AutomaticDecompression=System.Net.DecompressionMethods.All}){Timeout=TimeSpan.FromSeconds(15)};
    private static readonly System.Text.RegularExpressions.Regex VideoId=new("^[A-Za-z0-9_-]{11}$");
    private static string QueryValue(string path,string name)
    {
        var q=path.IndexOf('?');if(q<0)return "";
        foreach(var part in path[(q+1)..].Split('&')){var eq=part.IndexOf('=');var key=eq<0?part:part[..eq];if(key==name)return Uri.UnescapeDataString((eq<0?"":part[(eq+1)..]).Replace('+',' '));}
        return "";
    }
    internal async Task<Reply> YouTubeSearch(string raw)
    {
        var query=System.Text.RegularExpressions.Regex.Replace(raw??"",@"\s+"," ").Trim();
        if(query.Length==0||query.Length>120)return new(400,new{error="Type what to search for (up to 120 characters)."});
        try
        {
            using var request=new HttpRequestMessage(HttpMethod.Get,"https://www.youtube.com/results?search_query="+Uri.EscapeDataString(query)+"&sp=EgIQAQ%253D%253D");
            request.Headers.TryAddWithoutValidation("User-Agent","Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36");
            request.Headers.TryAddWithoutValidation("Accept-Language","en-US,en;q=0.9");
            request.Headers.TryAddWithoutValidation("Cookie","CONSENT=YES+cb; SOCS=CAI");
            using var response=await youtube.SendAsync(request);
            if(!response.IsSuccessStatusCode)return new(502,new{error="YouTube search is unavailable right now. Try again in a moment."});
            var data=InitialData(await response.Content.ReadAsStringAsync());
            var results=new List<object>();
            if(data!=null){using var doc=JsonDocument.Parse(data);Collect(doc.RootElement,results,new HashSet<string>(),0);}
            return new(200,new{results});
        }
        catch{return new(502,new{error="YouTube search is unavailable right now. Check the internet connection."});}
    }
    private static string? InitialData(string html)
    {
        foreach(var marker in new[]{"var ytInitialData = ","window[\"ytInitialData\"] = ","ytInitialData = "})
        {
            var at=html.IndexOf(marker,StringComparison.Ordinal);if(at<0)continue;
            var start=html.IndexOf('{',at);if(start<0)continue;
            int depth=0;bool inString=false,escaped=false;
            for(var i=start;i<html.Length;i++)
            {
                var ch=html[i];
                if(escaped){escaped=false;continue;}
                if(ch=='\\'){escaped=true;continue;}
                if(ch=='"'){inString=!inString;continue;}
                if(inString)continue;
                if(ch=='{')depth++;else if(ch=='}'&&--depth==0)return html.Substring(start,i-start+1);
            }
        }
        return null;
    }
    private static string Text(JsonElement node,string name)
    {
        if(node.ValueKind!=JsonValueKind.Object||!node.TryGetProperty(name,out var n))return "";
        if(n.ValueKind==JsonValueKind.String)return n.GetString()??"";
        if(n.ValueKind!=JsonValueKind.Object)return "";
        if(n.TryGetProperty("simpleText",out var s)&&s.ValueKind==JsonValueKind.String)return s.GetString()??"";
        if(n.TryGetProperty("runs",out var runs)&&runs.ValueKind==JsonValueKind.Array)
            return string.Concat(runs.EnumerateArray().Select(r=>r.ValueKind==JsonValueKind.Object&&r.TryGetProperty("text",out var t)&&t.ValueKind==JsonValueKind.String?t.GetString():""));
        return "";
    }
    private static void Collect(JsonElement node,List<object> results,HashSet<string> seen,int depth)
    {
        if(depth>30||results.Count>=30)return;
        if(node.ValueKind==JsonValueKind.Array){foreach(var item in node.EnumerateArray())Collect(item,results,seen,depth+1);return;}
        if(node.ValueKind!=JsonValueKind.Object)return;
        if(node.TryGetProperty("videoRenderer",out var v)&&v.ValueKind==JsonValueKind.Object&&v.TryGetProperty("videoId",out var idEl)&&idEl.ValueKind==JsonValueKind.String)
        {
            var id=idEl.GetString()??"";var duration=Text(v,"lengthText");var title=Text(v,"title").Trim();
            // No length means a live stream or a premiere: not something a deck can play through.
            if(VideoId.IsMatch(id)&&duration.Length>0&&title.Length>0&&seen.Add(id))
            {
                var channel=Text(v,"ownerText");if(channel.Length==0)channel=Text(v,"longBylineText");
                results.Add(new{id,title,channel,duration,views=Text(v,"shortViewCountText"),thumbnail=$"https://i.ytimg.com/vi/{id}/hqdefault.jpg",url=$"https://www.youtube.com/watch?v={id}"});
            }
        }
        foreach(var p in node.EnumerateObject())if(p.Name!="videoRenderer")Collect(p.Value,results,seen,depth+1);
    }
    public void Dispose(){client.Dispose();youtube.Dispose();}
}
