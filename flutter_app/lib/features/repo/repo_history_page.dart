import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../data/models/models.dart';
import '../auth/auth_controller.dart';
import 'repo_list_controller.dart';

/// 版本历史页：时间线 + 回滚 + 下载
class RepoHistoryPage extends ConsumerWidget {
  const RepoHistoryPage({super.key, required this.repoId});

  final int repoId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(repoHistoryProvider(repoId));
    final theme = Theme.of(context);
    final fmt = DateFormat('yyyy-MM-dd HH:mm:ss');

    return Scaffold(
      appBar: AppBar(
        title: const Text('版本历史'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () =>
                ref.read(repoHistoryProvider(repoId).notifier).refresh(),
          ),
        ],
      ),
      body: _buildBody(context, ref, state, theme, fmt),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref,
    RepoHistoryState state,
    ThemeData theme,
    DateFormat fmt,
  ) {
    if (state.loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline_rounded,
                size: 48, color: theme.colorScheme.error),
            const SizedBox(height: 12),
            Text(state.error!,
                style: TextStyle(color: theme.colorScheme.error)),
            const SizedBox(height: 16),
            FilledButton.tonal(
              onPressed: () =>
                  ref.read(repoHistoryProvider(repoId).notifier).refresh(),
              child: const Text('重试'),
            ),
          ],
        ),
      );
    }
    if (state.commits.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.history_rounded,
                size: 56, color: theme.colorScheme.outline),
            const SizedBox(height: 12),
            Text(
              '暂无提交历史',
              style: TextStyle(color: theme.colorScheme.outline),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        // 快照大小信息
        if (state.snapshotBytes > 0)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: theme.colorScheme.primaryContainer.withValues(alpha: 0.3),
            child: Row(
              children: [
                Icon(Icons.storage_rounded,
                    size: 14, color: theme.colorScheme.primary),
                const SizedBox(width: 6),
                Text(
                  '当前快照大小: ${_fmtBytes(state.snapshotBytes)}',
                  style: TextStyle(
                    fontSize: 12,
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        // 提交时间线
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            itemCount: state.commits.length,
            itemBuilder: (context, index) {
              final commit = state.commits[index];
              final isLatest = index == 0;
              return _CommitTimelineTile(
                commit: commit,
                isLatest: isLatest,
                isFirst: index == 0,
                isLast: index == state.commits.length - 1,
                fmt: fmt,
                onRollback: isLatest
                    ? null
                    : () => _confirmRollback(context, ref, commit),
                onDownload: () => _download(context, ref, commit),
              );
            },
          ),
        ),
      ],
    );
  }

  void _confirmRollback(
    BuildContext context,
    WidgetRef ref,
    RepoCommit commit,
  ) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('确认回滚'),
        content: Text(
          '确定回滚到 ${commit.shortSha}？\n\n'
          '此操作将追加一条回滚提交，不会丢失当前历史。\n'
          '快照中的会话将覆盖当前数据。',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              final ok = await ref
                  .read(repoHistoryProvider(repoId).notifier)
                  .rollback(commit.sha);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(ok ? '已回滚到 ${commit.shortSha}' : '回滚失败'),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              }
            },
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.tertiary,
              foregroundColor: Theme.of(context).colorScheme.onTertiary,
            ),
            child: const Text('回滚'),
          ),
        ],
      ),
    );
  }

  Future<void> _download(
    BuildContext context,
    WidgetRef ref,
    RepoCommit commit,
  ) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final api = ref.read(v1ApiProvider);
      final res = await api.downloadSnapshot(repoId: repoId, sha: commit.sha);
      final bytes = res.data as List<int>;
      final sizeStr = _fmtBytes(bytes.length);
      if (context.mounted) {
        messenger.showSnackBar(
          SnackBar(
            content: Text('快照 ${commit.shortSha} 已获取（$sizeStr）'),
            behavior: SnackBarBehavior.floating,
          ),
        );
        // 展示快照预览
        _showSnapshotPreview(context, commit, bytes);
      }
    } catch (e) {
      if (context.mounted) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text('下载失败'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _showSnapshotPreview(
    BuildContext context,
    RepoCommit commit,
    List<int> bytes,
  ) {
    final text = String.fromCharCodes(bytes);
    final preview = text.length > 5000
        ? '${text.substring(0, 5000)}\n\n...（共 ${text.length} 字符，已截断）'
        : text;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.3,
        maxChildSize: 0.9,
        expand: false,
        builder: (ctx, controller) => Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(Icons.description_outlined,
                      size: 20, color: Theme.of(ctx).colorScheme.primary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '快照预览 · ${commit.shortSha}',
                      style: Theme.of(ctx).textTheme.titleSmall,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: SingleChildScrollView(
                controller: controller,
                padding: const EdgeInsets.all(16),
                child: Text(
                  preview,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 12,
                    height: 1.5,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _fmtBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

class _CommitTimelineTile extends StatelessWidget {
  const _CommitTimelineTile({
    required this.commit,
    required this.isLatest,
    required this.isFirst,
    required this.isLast,
    required this.fmt,
    required this.onRollback,
    required this.onDownload,
  });

  final RepoCommit commit;
  final bool isLatest;
  final bool isFirst;
  final bool isLast;
  final DateFormat fmt;
  final VoidCallback? onRollback;
  final VoidCallback onDownload;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final lineColor = isLatest
        ? theme.colorScheme.primary
        : theme.colorScheme.outline.withValues(alpha: 0.3);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 时间线轴线 + 节点
        SizedBox(
          width: 28,
          child: Column(
            children: [
              // 上半段线
              Container(
                width: 2,
                height: isFirst ? 12 : 20,
                color: isFirst ? Colors.transparent : lineColor,
              ),
              // 节点
              Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isLatest
                      ? theme.colorScheme.primary
                      : theme.colorScheme.surface,
                  border: Border.all(
                    color: isLatest ? theme.colorScheme.primary : lineColor,
                    width: 2,
                  ),
                  boxShadow: isLatest
                      ? [
                          BoxShadow(
                            color: theme.colorScheme.primary
                                .withValues(alpha: 0.3),
                            blurRadius: 6,
                            spreadRadius: 1,
                          )
                        ]
                      : null,
                ),
              ),
              // 下半段线
              Expanded(
                child: Container(
                  width: 2,
                  color: isLast ? Colors.transparent : lineColor,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        // 内容
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // SHA + 最新标签
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(
                          color:
                              theme.colorScheme.primary.withValues(alpha: 0.2),
                        ),
                      ),
                      child: Text(
                        commit.shortSha,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: theme.colorScheme.primary,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                    if (isLatest) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.tertiary
                              .withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(3),
                          border: Border.all(
                            color: theme.colorScheme.tertiary
                                .withValues(alpha: 0.3),
                          ),
                        ),
                        child: Text(
                          '最新',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: theme.colorScheme.tertiary,
                          ),
                        ),
                      ),
                    ],
                    const Spacer(),
                    Text(
                      commit.date != null
                          ? fmt.format(commit.date!.toLocal())
                          : '-',
                      style: TextStyle(
                        fontSize: 11,
                        color: theme.colorScheme.outline,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                // 提交信息
                Text(
                  commit.message,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                // 操作按钮
                Row(
                  children: [
                    TextButton.icon(
                      onPressed: onDownload,
                      icon: const Icon(Icons.download_outlined, size: 14),
                      label: const Text('下载', style: TextStyle(fontSize: 12)),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        minimumSize: const Size(0, 28),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    ),
                    if (onRollback != null) ...[
                      const SizedBox(width: 4),
                      TextButton.icon(
                        onPressed: onRollback,
                        icon: Icon(Icons.undo_rounded,
                            size: 14, color: theme.colorScheme.tertiary),
                        label: Text('回滚',
                            style: TextStyle(
                                fontSize: 12,
                                color: theme.colorScheme.tertiary)),
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          minimumSize: const Size(0, 28),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                      ),
                    ] else
                      Text(
                        '（当前版本）',
                        style: TextStyle(
                          fontSize: 11,
                          color: theme.colorScheme.outline,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
