import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_theme.dart';
import 'ad_reward_controller.dart';

/// 广告激励页：观看激励视频获取当日 Pro/Plus 权益。
class AdRewardPage extends ConsumerWidget {
  const AdRewardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(adRewardControllerProvider);
    final neu = NeuColors.of(context);
    final status = state.status;

    return Scaffold(
      appBar: AppBar(title: const Text('看广告 · 免费会员')),
      body: state.loading && status == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () =>
                  ref.read(adRewardControllerProvider.notifier).loadStatus(),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (state.error != null)
                    _ErrorBanner(message: state.error!, neu: neu),
                  if (status != null) ...[
                    _BoostCard(status: status, neu: neu),
                    const SizedBox(height: 16),
                    _ProgressCard(status: status, neu: neu),
                    const SizedBox(height: 16),
                    _StreakCard(status: status, neu: neu),
                    const SizedBox(height: 24),
                  ],
                  _WatchButton(
                    watching: state.watching,
                    loading: state.loading,
                    canWatch: status?.todayComplete == false,
                    onPressed: state.watching
                        ? null
                        : () => ref
                            .read(adRewardControllerProvider.notifier)
                            .watchAd(),
                    neu: neu,
                  ),
                  const SizedBox(height: 16),
                  _RulesCard(neu: neu),
                ],
              ),
            ),
    );
  }
}

// ── 当前 boost 等级卡片 ──────────────────────────────────

class _BoostCard extends StatelessWidget {
  const _BoostCard({required this.status, required this.neu});
  final dynamic status; // AdStatus
  final NeuColors neu;

  @override
  Widget build(BuildContext context) {
    final tier = status.rewardTier as String?;
    final active = tier != null;
    final (color, label, desc) = switch (tier) {
      'PLUS' => (const Color(0xFF4A6CF7), 'PLUS 已激活', '今日 Plus 权益生效中'),
      'PRO' => (const Color(0xFFF57C00), 'PRO 已激活', '今日 Pro 权益生效中'),
      _ => (const Color(0xFF90A4AE), '暂无广告权益', '看满 ${status.requiredDaily} 次广告即可激活'),
    };

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: NeuBoxDecoration(
        color: neu.surface,
        shadowDark: neu.shadowDark,
        shadowLight: neu.shadowLight,
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              active ? Icons.bolt_rounded : Icons.bolt_outlined,
              color: color,
              size: 28,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: color)),
                const SizedBox(height: 4),
                Text(desc, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── 今日进度卡片 ──────────────────────────────────────────

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.status, required this.neu});
  final dynamic status; // AdStatus
  final NeuColors neu;

  @override
  Widget build(BuildContext context) {
    final watched = status.watchedToday as int;
    final required = status.requiredDaily as int;
    final remaining = (required - watched).clamp(0, required);
    final progress = required > 0 ? watched / required : 0.0;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: NeuBoxDecoration(
        color: neu.surface,
        shadowDark: neu.shadowDark,
        shadowLight: neu.shadowLight,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('今日进度',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700)),
              Text('$watched / $required',
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: Theme.of(context).colorScheme.primary)),
            ],
          ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 12,
              backgroundColor: neu.shadowDark.withValues(alpha: 0.3),
              valueColor: AlwaysStoppedAnimation(
                  Theme.of(context).colorScheme.primary),
            ),
          ),
          const SizedBox(height: 12),
          if (remaining > 0)
            Text('再看 $remaining 次广告即可获得今日 ${status.nextRewardTier} 权益',
                style: Theme.of(context).textTheme.bodySmall)
          else
            Row(children: [
              Icon(Icons.check_circle_rounded,
                  size: 16, color: Colors.green.shade600),
              const SizedBox(width: 6),
              Text('今日已达标！权益将在广告回调到达后激活',
                  style: TextStyle(
                      color: Colors.green.shade600,
                      fontWeight: FontWeight.w600)),
            ]),
        ],
      ),
    );
  }
}

// ── 连击日历卡片 ──────────────────────────────────────────

class _StreakCard extends StatelessWidget {
  const _StreakCard({required this.status, required this.neu});
  final dynamic status; // AdStatus
  final NeuColors neu;

  @override
  Widget build(BuildContext context) {
    final streak = status.streakDays as int;
    final forPlus = status.streakForPlus as int;
    final nextTier = status.nextRewardTier as String;
    final daysToPlus = (forPlus - streak).clamp(0, forPlus);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: NeuBoxDecoration(
        color: neu.surface,
        shadowDark: neu.shadowDark,
        shadowLight: neu.shadowLight,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.local_fire_department_rounded,
                  color: Colors.orange.shade700, size: 22),
              const SizedBox(width: 8),
              Text('连续达标 $streak 天',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 16),
          // 连击进度条
          Row(
            children: List.generate(forPlus, (i) {
              final filled = i < streak;
              return Expanded(
                child: Container(
                  margin: EdgeInsets.only(right: i < forPlus - 1 ? 6 : 0),
                  height: 8,
                  decoration: BoxDecoration(
                    color: filled
                        ? Colors.orange.shade600
                        : neu.shadowDark.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 12),
          if (streak >= forPlus)
            Text('已达 $forPlus 天连续达标，今日将获得 PLUS 权益！',
                style: TextStyle(
                    color: const Color(0xFF4A6CF7),
                    fontWeight: FontWeight.w600))
          else
            Text('再连续达标 $daysToPlus 天即可升级为每日 $nextTier → PLUS',
                style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 4),
          Text('中断后连击将归零，需重新从 PRO 开始',
              style: TextStyle(
                  fontSize: 12, color: neu.textSecondary)),
        ],
      ),
    );
  }
}

// ── 观看按钮 ──────────────────────────────────────────────

class _WatchButton extends StatelessWidget {
  const _WatchButton({
    required this.watching,
    required this.loading,
    required this.canWatch,
    required this.onPressed,
    required this.neu,
  });

  final bool watching;
  final bool loading;
  final bool canWatch;
  final VoidCallback? onPressed;
  final NeuColors neu;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: onPressed,
        icon: watching
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white))
            : const Icon(Icons.play_circle_fill_rounded),
        label: Text(watching
            ? '广告播放中…'
            : canWatch
                ? '观看广告 +1'
                : '今日已达标'),
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16)),
        ),
      ),
    );
  }
}

// ── 规则说明卡片 ──────────────────────────────────────────

class _RulesCard extends StatelessWidget {
  const _RulesCard({required this.neu});
  final NeuColors neu;

  @override
  Widget build(BuildContext context) {
    final rules = [
      '每日看满 5 次激励视频 → 获得当日 PRO 权益',
      '连续 3 日达标 → 升级为当日 PLUS 权益',
      '广告权益为日级 boost，叠加在付费等级之上，不降级',
      '中断观看后连击归零，需重新从 PRO 开始',
    ];
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: NeuBoxDecoration(
        color: neu.surface,
        shadowDark: neu.shadowDark,
        shadowLight: neu.shadowLight,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.info_outline,
                size: 18, color: neu.textSecondary),
            const SizedBox(width: 6),
            Text('规则说明',
                style: TextStyle(
                    fontWeight: FontWeight.w700, color: neu.textSecondary)),
          ]),
          const SizedBox(height: 12),
          ...rules.map((r) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('·', style: TextStyle(color: neu.textSecondary)),
                    const SizedBox(width: 6),
                    Expanded(
                        child: Text(r,
                            style: TextStyle(
                                fontSize: 13, color: neu.textSecondary))),
                  ],
                ),
              )),
        ],
      ),
    );
  }
}

// ── 错误提示 ──────────────────────────────────────────────

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.neu});
  final String message;
  final NeuColors neu;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Row(children: [
        Icon(Icons.error_outline, color: Colors.red.shade700, size: 20),
        const SizedBox(width: 8),
        Expanded(
            child: Text(message,
                style: TextStyle(color: Colors.red.shade700, fontSize: 13))),
      ]),
    );
  }
}
