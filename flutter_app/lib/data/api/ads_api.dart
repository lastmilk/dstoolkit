import 'package:dio/dio.dart';

import '../../features/ads/ad_models.dart';

/// /api/ads/* 广告激励 API（Bearer dstk_ 鉴权由 Dio 拦截器注入）
class AdsApi {
  AdsApi(this.dio);

  final Dio dio;

  /// GET /api/ads/status — 当日广告进度 + 连击 + boost 等级
  Future<AdStatus> status() async {
    final res = await dio.get('/ads/status');
    return AdStatus.fromJson(res.data as Map<String, dynamic>);
  }

  /// GET /api/ads/history?days=N — 近 N 日观看记录（连击日历）
  Future<List<AdHistoryLog>> history({int days = 30}) async {
    final res = await dio.get('/ads/history', queryParameters: {'days': days});
    final list = (res.data as Map<String, dynamic>)['logs'] as List<dynamic>;
    return list
        .map((e) => AdHistoryLog.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
