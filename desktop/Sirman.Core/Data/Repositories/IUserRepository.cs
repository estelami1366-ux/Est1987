using Sirman.Core.Security;

namespace Sirman.Core.Data.Repositories;

/// <summary>
/// مرز persist کاربر. نزدیک‌ترین نوع CLR موجود <see cref="LoginUser"/> است
/// (لیست userRoles در HTML است؛ Core persist کاربر ندارد).
/// همتای MergeItem در <c>Sirman.Core.Data</c> برای کاربر وجود ندارد.
/// این اینترفیس هنوز به BusinessFacade / HTML وصل نشده است.
/// </summary>
public interface IUserRepository
{
    /// <summary>خواندن کاربر با نام کاربری.</summary>
    LoginUser? GetByUsername(string username);

    /// <summary>همهٔ کاربران کیسهٔ persist.</summary>
    IReadOnlyList<LoginUser> GetAll();

    /// <summary>ذخیره/جایگزینی کاربر. احراز هویت و نقش اینجا نیست.</summary>
    void Save(LoginUser user);
}
