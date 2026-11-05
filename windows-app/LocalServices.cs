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
    public void Dispose()=>client.Dispose();
}
