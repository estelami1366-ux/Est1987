using Sirman.Core.Printing;
using Xunit;

namespace Sirman.Core.Tests;

public class PostalLabelLayoutPlanTests
{
    [Fact]
    public void ShortPersianAddress_IsCompleteOnSenderPlan()
    {
        var sender = new PostalParty { Addr = "تهران", Zip = "11111", Tel = "0211", Person = "علی" };
        var plan = PostalLabelFieldPlan.Sender(sender);
        Assert.Equal("تهران", plan.Single(f => f.Kind == PostalLabelDrawnField.Address).StoredValue);
        Assert.False(PostalLabelFieldPlan.ContainsEllipsisLiteral(plan.Single(f => f.Kind == PostalLabelDrawnField.Address).StoredValue));
    }

    [Fact]
    public void LongPersianAddress_IsNotTruncatedInPlan()
    {
        var addr = "تهران، خیابان انقلاب، نرسیده به چهارراه کالج، کوچه شهید احمدی، پلاک ۱۲۴۸، واحد ۳، طبقه دوم، مقابل پارک";
        var sender = new PostalParty { Addr = addr, Zip = "2000-35155", Tel = "02188991234" };
        var field = PostalLabelFieldPlan.Sender(sender).Single(f => f.Kind == PostalLabelDrawnField.Address);
        Assert.Equal(addr, field.StoredValue);
        Assert.Contains("فرستنده:", PostalLabelFieldPlan.AddressDrawText(field), StringComparison.Ordinal);
        Assert.DoesNotContain("...", field.StoredValue, StringComparison.Ordinal);
    }

    [Fact]
    public void PostalCode_2000_35155_StaysUnreversedAndLtrIsolated()
    {
        var sender = new PostalParty { Zip = "2000-35155" };
        var zip = PostalLabelFieldPlan.Sender(sender).Single(f => f.Kind == PostalLabelDrawnField.Zip);
        Assert.Equal("2000-35155", zip.StoredValue);
        Assert.True(zip.NumericLtr);
        var presented = PostalLabelFieldPlan.NumericPresentation(zip.StoredValue);
        Assert.Equal("2000-35155", NativePrintBidi.Unwrap(presented));
        Assert.DoesNotContain("35155-2000", presented, StringComparison.Ordinal);
        Assert.StartsWith("\u202A", presented);
        Assert.EndsWith("\u202C", presented);
        Assert.Equal("35155-2000", NativePrintBidi.ReverseHyphenated("2000-35155"));
    }

    [Fact]
    public void LongTelephone_StaysCompleteAndSeparateFromPerson()
    {
        var tel = "021-8899-123456789";
        var sender = new PostalParty { Tel = tel, Person = "خانم رضایی مسئول ارسال" };
        var plan = PostalLabelFieldPlan.Sender(sender);
        var phone = plan.Single(f => f.Kind == PostalLabelDrawnField.Phone);
        var person = plan.Single(f => f.Kind == PostalLabelDrawnField.Person);
        Assert.Equal(tel, phone.StoredValue);
        Assert.True(phone.NumericLtr);
        Assert.Equal("خانم رضایی مسئول ارسال", person.StoredValue);
        Assert.False(person.NumericLtr);
        Assert.DoesNotContain(person.StoredValue, phone.StoredValue, StringComparison.Ordinal);
        Assert.DoesNotContain(tel, person.StoredValue, StringComparison.Ordinal);
    }

    [Fact]
    public void PersianSenderPerson_IsOwnRtlField()
    {
        var plan = PostalLabelFieldPlan.Sender(new PostalParty { Tel = "09121234567", Person = "آقای محمدی" });
        Assert.Contains(plan, f => f.Kind == PostalLabelDrawnField.Person && f.StoredValue == "آقای محمدی" && !f.NumericLtr);
        Assert.Equal("09121234567", plan.Single(f => f.Kind == PostalLabelDrawnField.Phone).StoredValue);
    }

    [Fact]
    public void RecipientName_AndFragileNote_AreComplete()
    {
        var rcv = new PostalParty
        {
            Name = "علی رضایی",
            Addr = "اصفهان، خیابان چهارباغ، پلاک ۱۲",
            Zip = "81400-11111",
            Tel = "03132221111",
            Note = "شکستنی — با احتیاط حمل شود"
        };
        var plan = PostalLabelFieldPlan.Recipient(rcv, fragile: true);
        Assert.Equal("علی رضایی", plan.Single(f => f.Kind == PostalLabelDrawnField.Name).StoredValue);
        Assert.Equal("شکستنی — با احتیاط حمل شود", plan.Single(f => f.Kind == PostalLabelDrawnField.Note).StoredValue);
        Assert.DoesNotContain(plan, f => PostalLabelFieldPlan.ContainsEllipsisLiteral(f.StoredValue));
    }

    [Fact]
    public void MixedPersianAndDigits_StayCompleteInAddress()
    {
        var addr = "تهران منطقه ۱۲، پلاک ۲۰۰0، کد فرعی 35155";
        var plan = PostalLabelFieldPlan.Recipient(new PostalParty { Addr = addr, Zip = "2000-35155", Tel = "0912" }, true);
        Assert.Equal(addr, plan.Single(f => f.Kind == PostalLabelDrawnField.Address).StoredValue);
        Assert.Equal("2000-35155", plan.Single(f => f.Kind == PostalLabelDrawnField.Zip).StoredValue);
    }

    [Fact]
    public void FragileOff_OmitsNoteField()
    {
        var plan = PostalLabelFieldPlan.Recipient(new PostalParty { Note = "شکستنی" }, fragile: false);
        Assert.DoesNotContain(plan, f => f.Kind == PostalLabelDrawnField.Note);
    }

    [Fact]
    public void EmptyPerson_IsNotAField()
    {
        var plan = PostalLabelFieldPlan.Sender(new PostalParty { Tel = "0211", Person = "  " });
        Assert.DoesNotContain(plan, f => f.Kind == PostalLabelDrawnField.Person);
        Assert.Equal("0211", plan.Single(f => f.Kind == PostalLabelDrawnField.Phone).StoredValue);
    }
}
