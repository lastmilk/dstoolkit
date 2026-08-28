import 'package:flutter/services.dart';

import 'ad_models.dart';

/// 原生激励视频广告 MethodChannel 封装。
///
/// Android 侧 [MainActivity] 注册了 "dstoolkit/ads" 通道：
/// - method "showRewardVideo" + { userId } → 展示穿山甲激励视频
/// - 返回 { code: success|skipped|error, rewarded: bool, message: String? }
///
/// 广告奖励的实际发放由穿山甲服务端 S2S 回调（/webhoook/verify）完成，
/// 此通道仅负责"展示广告 + 反馈观看结果"，Flutter 侧随后刷新 /api/ads/status。
class RewardAdChannel {
  RewardAdChannel._();

  static const _channel = MethodChannel('dstoolkit/ads');

  /// 展示激励视频广告。userId 传入穿山甲 AdSlot.setUserID，用于 S2S 回调归属。
  static Future<AdWatchResult> showRewardVideo(String userId) async {
    try {
      final res = await _channel.invokeMethod<Map>('showRewardVideo', {
        'userId': userId,
      });
      if (res == null) {
        return const AdWatchResult(code: 'error', rewarded: false, message: '无返回值');
      }
      return AdWatchResult.fromJson(res.cast<String, dynamic>());
    } on PlatformException catch (e) {
      return AdWatchResult(
        code: 'error',
        rewarded: false,
        message: '${e.code}: ${e.message ?? e.details}',
      );
    } on MissingPluginException {
      return const AdWatchResult(
        code: 'error',
        rewarded: false,
        message: '当前平台不支持激励视频',
      );
    }
  }
}
