import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
import '../../data/models/models.dart';
import '../../widgets/guest_gate.dart';
import 'repo_list_controller.dart';

/// 仓库管理页：列表 / 版本历史入口 / 删除
class RepoListPage extends ConsumerWidget {
  const RepoListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(repoListProvider);
    final neu = NeuColors.of(context);

    return GuestGate(
      title: '登录后管理你的聊天仓库',
      subtitle: 'Git 版本化管理对话记录\n支持版本历史查看与回滚',
      child: Scaffold(
        appBar: AppBar(
          title: const Text('聊天仓库'),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              onPressed: () => ref.read(repoListProvider.notifier).refresh(),
            ),
          ],
        ),
        body: RefreshIndicator(
          onRefresh: () => ref.read(repoListProvider.notifier).refresh(),
          child: _buildBody(context, ref, state, neu),
        ),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    WidgetRef ref,
    RepoListState state,
    NeuColors neu,
  ) {
    if (state.loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.error != null) {
      return _ErrorView(
        error: state.error!,
        onRetry: () => ref.read(repoListProvider.notifier).refresh(),
      );
    }
    if (state.repos.isEmpty) {
      return _EmptyHint(
        icon: Icons.folder_off_outlined,
        text: '暂无聊天仓库\n请先在 Web 端创建并导入对话',
      );
    }
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      itemCount: state.repos.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final repo = state.repos[index];
        return _RepoCard(
          repo: repo,
          surface: neu.surface,
          shadowDark: neu.shadowDark,
          shadowLight: neu.shadowLight,
          onHistory: () => context.push('/repos/${repo.id}/history'),
          onDelete: () => _confirmDelete(context, ref, repo),
        );
      },
    );
  }

  void _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    ChatRepo repo,
  ) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('删除仓库'),
        content: Text('确定删除仓库「${repo.name}」？\n所有对话数据和 Git 历史将被清除，此操作不可撤销。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              ref.read(repoListProvider.notifier).deleteRepo(repo.id);
            },
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
              foregroundColor: Theme.of(context).colorScheme.onError,
            ),
            child: const Text('删除'),
          ),
        ],
      ),
    );
  }
}

class _RepoCard extends StatelessWidget {
  const _RepoCard({
    required this.repo,
    required this.surface,
    required this.shadowDark,
    required this.shadowLight,
    required this.onHistory,
    required this.onDelete,
  });

  final ChatRepo repo;
  final Color surface;
  final Color shadowDark;
  final Color shadowLight;
  final VoidCallback onHistory;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final fmt = DateFormat('yyyy-MM-dd HH:mm');

    return Container(
      decoration: NeuBoxDecoration(
        color: surface,
        shadowDark: shadowDark,
        shadowLight: shadowLight,
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 仓库标题 + 提交数标签
          Row(
            children: [
              Icon(Icons.folder_rounded,
                  size: 20, color: theme.colorScheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  repo.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
              ),
              if (repo.commitCount > 0)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '${repo.commitCount} 次提交',
                    style: TextStyle(
                      fontSize: 11,
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
            ],
          ),

          // 描述
          if (repo.description != null && repo.description!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              repo.description!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.outline),
            ),
          ],

          const SizedBox(height: 12),

          // 元信息
          _MetaRow(
            icon: Icons.chat_bubble_outline_rounded,
            text: '${repo.conversationCount} 个对话',
            color: theme.colorScheme.primary,
          ),
          if (repo.lastCommitSha != null) ...[
            const SizedBox(height: 6),
            _MetaRow(
              icon: Icons.commit_outlined,
              text:
                  '最新提交: ${repo.lastCommitSha!.substring(0, repo.lastCommitSha!.length.clamp(0, 7))}',
              color: theme.colorScheme.tertiary,
            ),
          ],
          const SizedBox(height: 6),
          _MetaRow(
            icon: Icons.schedule_rounded,
            text: repo.updatedAt != null
                ? fmt.format(repo.updatedAt!.toLocal())
                : '-',
            color: theme.colorScheme.outline,
          ),

          // 操作按钮
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: FilledButton.tonalIcon(
                  onPressed: onHistory,
                  icon: const Icon(Icons.history_rounded, size: 16),
                  label: const Text('版本历史'),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.tonalIcon(
                onPressed: onDelete,
                icon: Icon(Icons.delete_outline_rounded,
                    size: 16, color: theme.colorScheme.error),
                label: Text('删除',
                    style: TextStyle(color: theme.colorScheme.error)),
                style: FilledButton.styleFrom(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({
    required this.icon,
    required this.text,
    required this.color,
  });

  final IconData icon;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 14, color: color),
        const SizedBox(width: 4),
        Text(
          text,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: color),
        ),
      ],
    );
  }
}

class _EmptyHint extends StatelessWidget {
  const _EmptyHint({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 120),
        Center(
          child: Column(
            children: [
              Icon(icon,
                  size: 56, color: Theme.of(context).colorScheme.outline),
              const SizedBox(height: 12),
              Text(
                text,
                textAlign: TextAlign.center,
                style: TextStyle(color: Theme.of(context).colorScheme.outline),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.error, required this.onRetry});
  final String error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline_rounded,
              size: 48, color: Theme.of(context).colorScheme.error),
          const SizedBox(height: 12),
          Text(error,
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
          const SizedBox(height: 16),
          FilledButton.tonal(
            onPressed: onRetry,
            child: const Text('重试'),
          ),
        ],
      ),
    );
  }
}
