using System.IO;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PrepRep;

/// <summary>
/// Everything the page asks the PC to do. Add one case per job; answer with a result object, or
/// {"error": "a plain sentence"} when it can't be done. Starts with:
///   ping       -> {"ok": true, "version": "..."}            (the page checks the engine is there)
///   load       -> the saved data, or {}                      (used by the store part)
///   save       -> writes payload.data to data.json safely
/// </summary>
public sealed class Engine
{
    public static readonly string DataDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PrepRep");
    private static readonly string DataFile = Path.Combine(DataDir, "data.json");

    public static string WebDir { get; private set; } = "";

    public static string UnpackWeb()
    {
        var asm = Assembly.GetExecutingAssembly();
        string dir = Path.Combine(DataDir, "web-" + (asm.GetName().Version?.ToString() ?? "0"));
        Directory.CreateDirectory(dir);
        foreach (string name in asm.GetManifestResourceNames())
        {
            if (!name.StartsWith("web/", StringComparison.Ordinal)) continue;
            string target = Path.Combine(dir, name.Substring(4).Replace('\\', Path.DirectorySeparatorChar).Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            using var src = asm.GetManifestResourceStream(name)!;
            using var dst = File.Create(target);
            src.CopyTo(dst);
        }
        WebDir = dir;
        return dir;
    }

    public async Task<object> HandleAsync(string type, JsonElement payload, Action<string>? partial = null)
    {
        switch (type)
        {
            case "ping":
                return new JsonObject { ["ok"] = true, ["version"] = Assembly.GetExecutingAssembly().GetName().Version?.ToString() };
            case "load":
                try { return JsonNode.Parse(await File.ReadAllTextAsync(DataFile)) ?? new JsonObject(); }
                catch { return new JsonObject(); }
            case "save":
            {
                Directory.CreateDirectory(DataDir);
                JsonNode current;
                try { current = JsonNode.Parse(await File.ReadAllTextAsync(DataFile)) ?? new JsonObject(); }
                catch { current = new JsonObject(); }
                if (payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("data", out var d) && d.ValueKind == JsonValueKind.Object)
                    foreach (var prop in d.EnumerateObject())
                        current[prop.Name] = JsonNode.Parse(prop.Value.GetRawText());
                string tmp = DataFile + ".tmp";
                await File.WriteAllTextAsync(tmp, current.ToJsonString());
                File.Move(tmp, DataFile, true);        // write-then-rename: a crash never leaves half a file
                return new JsonObject { ["ok"] = true };
            }
            case "logic":
            {
                string fn = payload.TryGetProperty("fn", out var f) ? f.GetString() ?? "" : "";
                if (!System.Text.RegularExpressions.Regex.IsMatch(fn, "^[a-z_][a-z0-9_]{0,40}$")) return new JsonObject { ["error"] = "Bad function name." };
                JsonNode? args = payload.TryGetProperty("args", out var a) ? JsonNode.Parse(a.GetRawText()) : null;
                return await Logic.Call(fn, args);
            }
            case "brain":
            {
                var r = await Logic.Call("__list__", null);
                return new JsonObject { ["source"] = Logic.Source(), ["functions"] = r["ok"]?.DeepClone() ?? new JsonArray(), ["error"] = r["error"]?.DeepClone() };
            }
            default:
                return new JsonObject { ["error"] = "The app doesn't know how to do '" + type + "' yet." };
        }
    }
}
