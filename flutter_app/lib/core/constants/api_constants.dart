/// API 与 Web 基址配置。
///
/// 生产默认直连 `https://api.dstoolkit.cn/api`；开发时通过 dart-define 覆盖：
/// ```sh
/// flutter run \
///   --dart-define=DSTK_API_BASE=http://10.0.2.2:3000/api \
///   --dart-define=DSTK_WEB_BASE=http://10.0.2.2:5173
/// ```
class ApiConstants {
  ApiConstants._();

  static const String apiBase = String.fromEnvironment(
    'DSTK_API_BASE',
    defaultValue: 'https://api.dstoolkit.cn/api',
  );

  /// 可用 API 线路（登录页线路检测按此列表测速）。
  /// dart-define 指定了自定义 base 时只保留该线路。
  static const List<String> apiLines = [
    'https://api.dstoolkit.cn/api',
    'https://dstoolkit.cn/api',
  ];

  static const String webBase = String.fromEnvironment(
    'DSTK_WEB_BASE',
    defaultValue: 'https://dstoolkit.cn',
  );

  /// 内置 OAuth2 公共客户端（PKCE）
  static const String clientId = 'dstk-mobile-app';
  static const String redirectUri = 'dstoolkit://oauth-callback';
  static const String callbackScheme = 'dstoolkit';
  static const List<String> scopes = [
    'read:conversations',
    'search',
    'profile',
    'offline_access',
  ];

  /// Web 端定价页（付费一律在 Web 解决）
  static String get pricingUrl => '$webBase/pricing';
}
