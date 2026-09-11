using System.Text.Json;
using System.Text.Json.Nodes;
using Sirman.Core.Infrastructure;

namespace Sirman.Core.Diagnostics;

/// <summary>
/// Additive JSON fields on existing Host/SafeError envelopes. Does not replace SafeError.
/// </summary>
public static class DiagnosticEnvelope
{
    public static string Augment(string json, string correlationId, DiagnosticResult? diagnostic)
    {
        JsonObject node;
        try
        {
            node = JsonNode.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json) as JsonObject ?? new JsonObject();
        }
        catch
        {
            node = new JsonObject();
        }
        node["correlationId"] = correlationId ?? "";
        if (diagnostic != null)
            node["diagnostic"] = JsonSerializer.SerializeToNode(ToWire(diagnostic), DiagnosticJson.Options);
        return node.ToJsonString();
    }

    public static string SafeErrorWithDiagnostic(string error, string message, string correlationId, DiagnosticResult diagnostic, Exception? ex = null) =>
        Augment(SafeError.Json(error, message, ex), correlationId, diagnostic);

    public static object ToWire(DiagnosticResult result) => new
    {
        succeeded = result.Succeeded,
        code = result.Code,
        title = result.Title,
        severity = result.Severity,
        whatHappened = result.WhatHappened,
        probableCause = result.ProbableCause,
        userAction = result.UserAction,
        dataImpact = result.DataImpact,
        correlationId = result.CorrelationId
    };
}
