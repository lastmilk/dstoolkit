import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/api/ads_api.dart';
import '../auth/auth_controller.dart';
import 'ad_models.dart';
import 'reward_ad_channel.dart';

/// /api/ads/* 广告 API provider（复用主 Dio 鉴权）
final adsApiProvider = Provider<AdsApi>((ref) => AdsApi(ref.watch(dioProvider)));

/// 广告激励页状态
class AdRewardState {
  const AdRewardState({
    this.status,
    this.history = const [],
    this.loading = false,
    this.watching = false,
    this.error,
  });

  final AdStatus? status;
  final List<AdHistoryLog> history;
  final bool loading;
  final bool watching; // 广告正在展示
  final String? error;

  AdRewardState copyWith({
    AdStatus? status,
    List<AdHistoryLog>? history,
    bool? loading,
    bool? watching,
    String? error,
    bool clearError = false,
  }) =>
      AdRewardState(
        status: status ?? this.status,
        history: history ?? this.history,
        loading: loading ?? this.loading,
        watching: watching ?? this.watching,
        error: clearError ? null : (error ?? this.error),
      );
}

class AdRewardController extends StateNotifier<AdRewardState> {
  AdRewardController(this._ref) : super(const AdRewardState()) {
    loadStatus();
  }

  final Ref _ref;

  AdsApi get _api => _ref.read(adsApiProvider);
  int? get _userId => _ref.read(authControllerProvider).user?.id;

  /// 加载广告状态 + 近 14 日记录
  Future<void> loadStatus() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final uid = _userId;
      if (uid == null) {
        state = state.copyWith(loading: false, error: '请先登录');
        return;
      }
      final results = await Future.wait([
        _api.status(),
        _api.history(days: 14),
      ]);
      state = state.copyWith(
        status: results[0] as AdStatus,
        history: results[1] as List<AdHistoryLog>,
        loading: false,
      );
    } catch (e) {
      state = state.copyWith(loading: false, error: '加载失败：$e');
    }
  }

  /// 展示激励视频；观看完成后刷新状态（等穿山甲 S2S 回调到达后端）
  Future<void> watchAd() async {
    if (state.watching) return;
    final uid = _userId;
    if (uid == null) {
      state = state.copyWith(error: '请先登录');
      return;
    }
    state = state.copyWith(watching: true, clearError: true);

    final result = await RewardAdChannel.showRewardVideo(uid.toString());

    if (result.code == 'success') {
      // 奖励回调可能延迟 1-2 秒到达后端，稍等后刷新
      await Future.delayed(const Duration(seconds: 2));
      await loadStatus();
    } else if (result.code == 'skipped') {
      state = state.copyWith(watching: false);
      // 跳过不刷新
    } else {
      state = state.copyWith(
        watching: false,
        error: result.message ?? '广告展示失败',
      );
    }
  }
}

final adRewardControllerProvider =
    StateNotifierProvider<AdRewardController, AdRewardState>(
        (ref) => AdRewardController(ref));
