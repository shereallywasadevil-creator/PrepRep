using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Text.Json.Nodes;

namespace PrepRep;

/// <summary>
/// Runs PrepRep's "brain": prepwise.py, written by Dilan's Local AI through the Builder (Claude built the screens).
/// Looks for the newest copy first, so each feature switches on as soon as the AI passes that step:
///   1. C:\LocalAI\app\prepwise.py   (live, straight from the Builder)
///   2. the copy packed inside the app (web/logic/prepwise.py), once the AI has finished it
/// Python is the official embeddable Python packed in the app (or the PC's own Python).
///   logic   {fn, args} -> {"ok": result} | {"missing": true} when the AI hasn't built that function yet | {"error"}
///   brain   -> {"source": path or null, "functions": [names it has]}
/// </summary>
public static class Logic
{
    private static readonly string PythonDir = Path.Combine(Engine.DataDir, "python");
    private static readonly SemaphoreSlim Lock = new(1, 1);
    private static string? _python;
    private static readonly string[] LiveCandidates = { @"C:\LocalAI\app\prepwise.py" };

    private const string Runner = @"
import importlib.util, json, sys
req = json.loads(sys.stdin.read())
spec = importlib.util.spec_from_file_location('prepwise', req['path'])
m = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(m)
except Exception as e:
    print(json.dumps({'error': 'The brain file has a problem: ' + type(e).__name__ + ': ' + str(e)})); sys.exit()
if req['fn'] == '__list__':
    print(json.dumps({'ok': sorted(n for n in dir(m) if not n.startswith('_') and callable(getattr(m, n)))})); sys.exit()
f = getattr(m, req['fn'], None)
if f is None:
    print(json.dumps({'missing': True})); sys.exit()
try:
    out = f(*req.get('args', []))
    print(json.dumps({'ok': out}, default=list))
except Exception as e:
    print(json.dumps({'error': type(e).__name__ + ': ' + str(e)}))
";

    public static string? Source()
    {
        foreach (var p in LiveCandidates) if (File.Exists(p)) return p;
        string packed = Path.Combine(Engine.WebDir, "logic", "prepwise.py");
        return File.Exists(packed) ? packed : null;
    }

    private static async Task<string?> EnsurePython()
    {
        if (_python != null) return _python;
        await Lock.WaitAsync();
        try
        {
            if (_python != null) return _python;
            string exe = Path.Combine(PythonDir, "python.exe");
            if (!File.Exists(exe))
            {
                using var zip = Assembly.GetExecutingAssembly().GetManifestResourceStream("python.zip");
                if (zip != null)
                {
                    string tmp = PythonDir + ".part";
                    if (Directory.Exists(tmp)) Directory.Move(tmp, tmp + "-" + DateTime.Now.Ticks);   // set aside, never delete
                    using (var archive = new ZipArchive(zip)) archive.ExtractToDirectory(tmp);
                    Directory.Move(tmp, PythonDir);
                }
            }
            if (File.Exists(exe)) return _python = exe;
            foreach (string c in new[] { "python", "py" })
            {
                try
                {
                    using var p = Process.Start(new ProcessStartInfo(c, "--version") { CreateNoWindow = true, UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true });
                    if (p != null && p.WaitForExit(5000) && p.ExitCode == 0) return _python = c;
                }
                catch { }
            }
            return null;
        }
        finally { Lock.Release(); }
    }

    public static async Task<JsonObject> Call(string fn, JsonNode? args)
    {
        string? src = Source();
        if (src == null) return new JsonObject { ["missing"] = true, ["why"] = "Your Local AI hasn't started building PrepRep's brain yet." };
        string? py = await EnsurePython();
        if (py == null) return new JsonObject { ["error"] = "PrepRep couldn't find Python on this PC." };
        var psi = new ProcessStartInfo(py) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
                                             StandardInputEncoding = new UTF8Encoding(false), StandardOutputEncoding = Encoding.UTF8 };
        foreach (var a in new[] { "-E", "-s", "-c", Runner }) psi.ArgumentList.Add(a);
        using var p = Process.Start(psi)!;
        var outTask = p.StandardOutput.ReadToEndAsync();
        var errTask = p.StandardError.ReadToEndAsync();
        await p.StandardInput.WriteAsync(new JsonObject { ["path"] = src, ["fn"] = fn, ["args"] = args?.DeepClone() ?? new JsonArray() }.ToJsonString());
        p.StandardInput.Close();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        try { await p.WaitForExitAsync(cts.Token); }
        catch (OperationCanceledException) { try { p.Kill(true); } catch { } return new JsonObject { ["error"] = fn + " took over 30 seconds." }; }
        string text = (await outTask).Trim();
        try { return JsonNode.Parse(text.Split('\n').Last())!.AsObject(); }
        catch { return new JsonObject { ["error"] = "The brain didn't answer: " + ((await errTask).Trim().Split('\n').LastOrDefault() ?? text) }; }
    }
}
