using System.Text.Json.Nodes;

namespace Sirman.Core.Data.Repositories;

/// <summary>
/// TBD: مالک بسته بک‌آپ HTML است. اینجا فقط MergeMap/MergeItem موجود را روی دو JsonObject اعمال می‌کند.
/// </summary>
public sealed class JsonBackupRepository : IBackupRepository
{
    public const string TbdMarker = "html-backup-engine";

    private readonly CurrentJsonStore _store;
    private JsonObject _last = new()
    {
        ["tbd"] = true,
        ["owner"] = CurrentStorage.Owner,
        ["kind"] = CurrentStorage.Kind,
        ["engine"] = TbdMarker
    };

    public JsonBackupRepository(CurrentJsonStore store) =>
        _store = store ?? throw new ArgumentNullException(nameof(store));

    public JsonObject Export() => RepositoryJson.Clone(_last);

    public JsonObject Import(JsonObject package)
    {
        _last = RepositoryJson.Clone(package ?? new JsonObject());
        return RepositoryJson.Clone(_last);
    }

    public JsonObject Merge(JsonObject live, JsonObject incoming) =>
        RepositoryJson.Clone(_store.MergeMap(live, incoming));
}
