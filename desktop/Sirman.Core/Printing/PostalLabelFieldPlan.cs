namespace Sirman.Core.Printing;

/// <summary>
/// Postal-card field order for the native renderer.
/// Phone and person stay separate. Stored values are never ellipsized here.
/// </summary>
public enum PostalLabelDrawnField
{
    Address,
    Zip,
    Phone,
    Person,
    Name,
    Note
}

public readonly record struct PostalLabelPlannedField(
    PostalLabelDrawnField Kind,
    string Label,
    string StoredValue,
    bool NumericLtr);

public static class PostalLabelFieldPlan
{
    public static IReadOnlyList<PostalLabelPlannedField> Sender(PostalParty? sender)
    {
        var s = sender ?? new PostalParty();
        var fields = new List<PostalLabelPlannedField>
        {
            new(PostalLabelDrawnField.Address, "فرستنده:", s.Addr ?? "", false),
            new(PostalLabelDrawnField.Zip, "کدپستی:", s.Zip ?? "", true),
            new(PostalLabelDrawnField.Phone, "شماره تماس:", s.Tel ?? "", true)
        };
        if (!string.IsNullOrWhiteSpace(s.Person))
            fields.Add(new(PostalLabelDrawnField.Person, "", s.Person, false));
        return fields;
    }

    public static IReadOnlyList<PostalLabelPlannedField> Recipient(PostalParty? recipient, bool fragile)
    {
        var r = recipient ?? new PostalParty();
        var fields = new List<PostalLabelPlannedField>
        {
            new(PostalLabelDrawnField.Address, "آدرس گیرنده:", r.Addr ?? "", false),
            new(PostalLabelDrawnField.Zip, "کدپستی:", r.Zip ?? "", true),
            new(PostalLabelDrawnField.Phone, "شماره تماس:", r.Tel ?? "", true)
        };
        if (!string.IsNullOrWhiteSpace(r.Name))
            fields.Add(new(PostalLabelDrawnField.Name, "", r.Name, false));
        if (fragile && !string.IsNullOrWhiteSpace(r.Note))
            fields.Add(new(PostalLabelDrawnField.Note, "", r.Note, false));
        return fields;
    }

    public static string AddressDrawText(PostalLabelPlannedField field) =>
        string.IsNullOrEmpty(field.Label)
            ? (field.StoredValue ?? "")
            : field.Label + " " + (field.StoredValue ?? "");

    public static string NumericPresentation(string? stored) =>
        NativePrintBidi.AsLeftToRight(stored);

    public static bool ContainsEllipsisLiteral(string? value) =>
        !string.IsNullOrEmpty(value) && (value.Contains("...", StringComparison.Ordinal) || value.Contains('…'));
}
