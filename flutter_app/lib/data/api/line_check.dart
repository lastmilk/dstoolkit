import 'package:dio/dio.dart';

/// 单条 API 线路的检测结果
class ApiLine {
  const ApiLine({
    required this.label,
    required this.baseUrl,
    required this.latencyMs,
    required this.ok,
  });

  final String label;
  final String baseUrl;

  /// 延迟（毫秒）；不可达时为 null
  final int? latencyMs;
  final bool ok;
}

/// 线路测速：并发请求各线路的 /auth/me，
/// 任何 HTTP 响应（含 401）都视为线路可达，实测往返延迟。
Future<List<ApiLine>> checkApiLines(List<String> baseUrls) async {
  final results = await Future.wait(baseUrls.map((base) async {
    final label = Uri.tryParse(base)?.host ?? base;
    final dio = Dio(BaseOptions(
      baseUrl: base,
      connectTimeout: const Duration(seconds: 8),
      receiveTimeout: const Duration(seconds: 8),
      // 不跟随重定向（重定向也说明线路活着）
      followRedirects: false,
      validateStatus: (_) => true,
    ));
    final sw = Stopwatch()..start();
    try {
      await dio.get<String>('/auth/me');
      sw.stop();
      return ApiLine(
        label: label,
        baseUrl: base,
        latencyMs: sw.elapsedMilliseconds,
        ok: true,
      );
    } catch (_) {
      sw.stop();
      return ApiLine(
        label: label,
        baseUrl: base,
        latencyMs: null,
        ok: false,
      );
    }
  }));

  // 可达线路按延迟升序；不可达排最后
  final sorted = [...results]..sort((a, b) {
      if (a.ok != b.ok) return a.ok ? -1 : 1;
      return (a.latencyMs ?? 99999).compareTo(b.latencyMs ?? 99999);
    });
  return sorted;
}
