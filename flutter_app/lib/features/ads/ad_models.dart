// 广告激励数据模型：与后端 /api/ads/* JSON 结构一一对应。

/// 广告观看状态（GET /api/ads/status 响应）
class AdStatus {
  const AdStatus({
    required this.watchedToday,
    required this.requiredDaily,
    required this.streakDays,
    required this.todayComplete,
    required this.rewardTier,
    required this.rewardExpiresAt,
    required this.nextRewardTier,
    required this.streakForPlus,
  });

  final int watchedToday;
  final int requiredDaily;
  final int streakDays;
  final bool todayComplete;
  final String? rewardTier; // PRO / PLUS / null
  final DateTime? rewardExpiresAt;
  final String nextRewardTier; // 今日达标后将获得的等级
  final int streakForPlus; // 升级 PLUS 所需连续达标天数

  factory AdStatus.fromJson(Map<String, dynamic> json) => AdStatus(
        watchedToday: (json['watchedToday'] as num?)?.toInt() ?? 0,
        requiredDaily: (json['requiredDaily'] as num?)?.toInt() ?? 5,
        streakDays: (json['streakDays'] as num?)?.toInt() ?? 0,
        todayComplete: json['todayComplete'] as bool? ?? false,
        rewardTier: json['rewardTier'] as String?,
        rewardExpiresAt: json['rewardExpiresAt'] == null
            ? null
            : DateTime.tryParse(json['rewardExpiresAt'] as String),
        nextRewardTier: json['nextRewardTier'] as String? ?? 'PRO',
        streakForPlus: (json['streakForPlus'] as num?)?.toInt() ?? 3,
      );
}

/// 单日广告记录（GET /api/ads/history 响应元素）
class AdHistoryLog {
  const AdHistoryLog({
    required this.date,
    required this.count,
    this.updatedAt,
  });

  final String date; // "YYYY-MM-DD"
  final int count;
  final DateTime? updatedAt;

  factory AdHistoryLog.fromJson(Map<String, dynamic> json) => AdHistoryLog(
        date: json['date'] as String? ?? '',
        count: (json['count'] as num?)?.toInt() ?? 0,
        updatedAt: json['updatedAt'] == null
            ? null
            : DateTime.tryParse(json['updatedAt'] as String),
      );
}

/// 原生激励视频广告结果（MethodChannel 回传）
class AdWatchResult {
  const AdWatchResult({
    required this.code, // success / skipped / error
    required this.rewarded,
    this.message,
  });

  final String code;
  final bool rewarded;
  final String? message;

  factory AdWatchResult.fromJson(Map<String, dynamic> json) => AdWatchResult(
        code: json['code'] as String? ?? 'error',
        rewarded: json['rewarded'] as bool? ?? false,
        message: json['message'] as String?,
      );
}
