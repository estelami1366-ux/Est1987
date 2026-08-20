using Sirman.Core.Security;

namespace Sirman.Core.Data.Repositories;

/// <summary>
/// مرز persist کاربر. نزدیک‌ترین نوع CLR موجود <see cref="LoginUser"/> است
/// (لیست userRoles در HTML است؛ Core persist کاربر ندارد).
/// </summary>
public interface IUserRepository
{
    LoginUser? GetByUsername(string username);
    IReadOnlyList<LoginUser> GetAll();
    void Save(LoginUser user);
}
