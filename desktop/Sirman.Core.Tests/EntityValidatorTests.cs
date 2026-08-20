using Sirman.Core.Validation;
using Xunit;

namespace Sirman.Core.Tests;

public class EntityValidatorTests
{
    private readonly EntityValidator _v = new();

    [Fact]
    public void Customer_RequiresName()
    {
        Assert.False(_v.Validate("customer", "{}").Ok);
        Assert.True(_v.Validate("customer", "{\"name\":\"علی\"}").Ok);
    }

    [Fact]
    public void Warranty_RequiresNameAndPhone()
    {
        Assert.False(_v.Validate("warranty", "{\"name\":\"علی\"}").Ok);
        Assert.True(_v.Validate("warranty", "{\"name\":\"علی\",\"phone\":\"0912\"}").Ok);
    }

    [Fact]
    public void Permission_MustExistInCatalog()
    {
        Assert.False(_v.Validate("permission", "{\"permission\":\"Foo.Bar\"}").Ok);
        Assert.True(_v.Validate("permission", "{\"permission\":\"Invoice.Create\"}").Ok);
    }

    [Fact]
    public void Payment_AmountMustBePositive()
    {
        Assert.False(_v.Validate("payment", "{\"amount\":\"0\"}").Ok);
        Assert.True(_v.Validate("payment", "{\"amount\":\"10\"}").Ok);
    }

    [Fact]
    public void UnknownEntity_DoesNotBlock()
    {
        Assert.True(_v.Validate("widget", "{}").Ok);
    }
}
