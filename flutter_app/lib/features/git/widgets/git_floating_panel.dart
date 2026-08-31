// =======================================================================
// git_floating_panel.dart
// Flutter 版对话界面嵌入的 Git 浮面板
// 功能：显示绑定仓库、分支切换、最近5次提交、Cherry/Revert/Reset入口
// =======================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../data/models/git_types.dart';
import '../providers/git_providers.dart';

class GitFloatingPanel extends ConsumerStatefulWidget {
  const GitFloatingPanel({
    super.key,
    required this.convId,
    this.convTitle,
  });
  final int convId;
  final String? convTitle;

  @override
  ConsumerState<GitFloatingPanel> createState() => _GitFloatingPanelState();
}

class _GitFloatingPanelState extends ConsumerState<GitFloatingPanel> {
  var _open = true;
  String? _selectedSha;

  @override
  Widget build(BuildContext context) {
    final repoAsync = ref.watch(convBindingRepoProvider(widget.convId));
    final theme = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.dividerColor),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            onTap: () => setState(() => _open = !_open),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [
                  theme.primaryColor.withOpacity(.12),
                  Colors.white,
                ]),
              ),
              child: Row(
                children: [
                  const Icon(Icons.account_tree, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: repoAsync.when(
                      data: (repo) => Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                repo?.name ?? '未绑定',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 13.5),
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 1),
                                decoration: BoxDecoration(
                                    color: Colors.green.withOpacity(.15),
                                    borderRadius: BorderRadius.circular(999)),
                                child: Text(
                                  repo?.type == GitRepoType.CONVERSATION
                                      ? '对话仓库'
                                      : '标准',
                                  style: TextStyle(
                                      color: Colors.green[800],
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w700),
                                ),
                              ),
                            ],
                          ),
                          Text(
                            '🌿 ${repo?.branchCount ?? 0} · 📦 ${repo?.commitCount ?? 0} · 🔀 ${repo?.pullRequestCount ?? 0}',
                            style: TextStyle(
                                color: theme.hintColor, fontSize: 11),
                          ),
                        ],
                      ),
                      loading: () => const Text('绑定中...',
                          style: TextStyle(fontSize: 12)),
                      error: (e, _) => Text('绑定失败: $e',
                          style: const TextStyle(
                              color: Colors.red, fontSize: 12)),
                    ),
                  ),
                  Icon(_open
                      ? Icons.keyboard_arrow_down
                      : Icons.keyboard_arrow_up),
                ],
              ),
            ),
          ),
          if (_open && repoAsync.value != null)
            _body(repoAsync.value!, theme),
        ],
      ),
    );
  }

  Widget _body(GitRepoEntity repo, ThemeData theme) {
    final branchesAsync = ref.watch(branchesProvider(repo.id));
    final tagsAsync = ref.watch(tagsProvider(repo.id));
    final refName = ref.watch(currentRefProvider(repo.id));
    final commitsAsync = ref.watch(commitsProvider(repo.id));
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 6, 10, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              branchesAsync.when(
                data: (brs) => _MiniBranchSelector(
                    current: refName,
                    branches: brs,
                    tags: tagsAsync.valueOrNull ?? const [],
                    onChanged: (v) => ref
                        .read(currentRefProvider(repo.id).notifier)
                        .state = v),
                loading: () => const SizedBox(
                    height: 28,
                    width: 28,
                    child: CircularProgressIndicator(strokeWidth: 2)),
                error: (e, _) => Text('Err: $e'),
              ),
              const Spacer(),
              TextButton.icon(
                onPressed: () => context.push('/git/repos/${repo.id}'),
                icon: const Icon(Icons.open_in_new, size: 14),
                label: const Text('完整仓库',
                    style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Text('📦 最近提交（$refName）',
                  style: TextStyle(
                      color: theme.hintColor,
                      fontSize: 11,
                      fontWeight: FontWeight.w700)),
              const Spacer(),
              TextButton.icon(
                onPressed: () => context.push('/git/repos/${repo.id}?tab=pr'),
                icon: const Icon(Icons.merge_type, size: 14),
                label: const Text('PR', style: TextStyle(fontSize: 12)),
              ),
              TextButton.icon(
                onPressed: () => context.push('/git/repos/${repo.id}?tab=reflog'),
                icon: const Icon(Icons.history, size: 14),
                label: const Text('Reflog', style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          commitsAsync.when(
            data: (cs) => cs.isEmpty
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 14),
                    child: Center(child: Text('暂无提交，首次对话后自动生成')),
                  )
                : Column(
                    children: cs
                        .take(8)
                        .map((c) => _commitItem(c, repo))
                        .toList(),
                  ),
            loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 14),
                child: Center(child: CircularProgressIndicator())),
            error: (e, _) => Text('Error: $e'),
          ),
        ],
      ),
    );
  }

  Widget _commitItem(GitCommitEntity c, GitRepoEntity repo) {
    const changeLabels = {
      'INIT': '初始化',
      'NEW_TURN': '新轮次',
      'EDIT_TURN': '改轮次',
      'DELETE_TURN': '删轮次',
      'MERGE': '合并',
      'REBASE': '变基',
      'REVERT': '回滚',
      'CHERRY_PICK': '拣选',
      'TAG': '标签',
    };
    final selected = _selectedSha == c.sha256;
    final theme = Theme.of(context);
    return InkWell(
      onTap: () => setState(() => _selectedSha = selected ? null : c.sha256),
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        decoration: BoxDecoration(
          color: selected
              ? theme.primaryColor.withOpacity(.1)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
              color: selected
                  ? theme.primaryColor
                  : Colors.transparent),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (c.changeType != null)
                  Container(
                    margin: const EdgeInsets.only(right: 4),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                        color: theme.primaryColor.withOpacity(.14),
                        borderRadius: BorderRadius.circular(3)),
                    child: Text(changeLabels[c.changeType] ?? c.changeType!,
                        style: TextStyle(
                            color: theme.primaryColor,
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700)),
                  ),
                Expanded(
                  child: Text(c.subject,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w600)),
                ),
                const SizedBox(width: 4),
                Text('+${c.additions}',
                    style: TextStyle(
                        color: Colors.green[700],
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700)),
                const SizedBox(width: 4),
                Text('-${c.deletions}',
                    style: TextStyle(
                        color: Colors.red[700],
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 2),
            Row(
              children: [
                Text(c.sha256.substring(0, 7),
                    style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 10.5,
                        color: theme.primaryColor,
                        fontWeight: FontWeight.w700)),
                const SizedBox(width: 6),
                Text(c.authorName,
                    style: TextStyle(
                        fontSize: 10.5, color: theme.hintColor)),
                const SizedBox(width: 4),
                Text('·', style: TextStyle(color: theme.hintColor)),
                const SizedBox(width: 4),
                Text(_ago(c.committedAt),
                    style: TextStyle(fontSize: 10.5, color: theme.hintColor)),
                if (selected) ...[
                  const Spacer(),
                  TextButton(
                      onPressed: () => _cherry(repo, c.sha256),
                      child: const Text('🍒 Cherry',
                          style: TextStyle(fontSize: 11))),
                  TextButton(
                      onPressed: () => _revert(repo, c.sha256),
                      child: const Text('↩️ Revert',
                          style: TextStyle(fontSize: 11))),
                  TextButton(
                      onPressed: () => _promptReset(repo, c.sha256),
                      child: Text('⏪ Reset ${ref.watch(currentRefProvider(repo.id)).substring(0, 6)}',
                          style: const TextStyle(fontSize: 11))),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _cherry(GitRepoEntity repo, String sha) async {
    final onto = ref.read(currentRefProvider(repo.id));
    try {
      final r = await ref
          .read(gitApiProvider)
          .cherryPick(repo.id, sha: sha, ontoBranchName: onto);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(r.message)));
        ref.invalidate(commitsProvider(repo.id));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('失败: $e')));
      }
    }
  }

  Future<void> _revert(GitRepoEntity repo, String sha) async {
    final onto = ref.read(currentRefProvider(repo.id));
    try {
      final r = await ref
          .read(gitApiProvider)
          .revert(repo.id, sha: sha, ontoBranchName: onto);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(r.message)));
        ref.invalidate(commitsProvider(repo.id));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('失败: $e')));
      }
    }
  }

  Future<void> _promptReset(GitRepoEntity repo, String sha) async {
    final branch = ref.read(currentRefProvider(repo.id));
    final mode = await showDialog<ResetMode>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('Reset $branch'),
        content: Text('目标: ${sha.substring(0, 7)}'),
        actions: ResetMode.values
            .map((m) => TextButton(
                  onPressed: () => Navigator.of(c).pop(m),
                  child: Text(m.name),
                ))
            .toList(),
      ),
    );
    if (mode == null) return;
    try {
      final r = await ref.read(gitApiProvider).reset(repo.id,
          branchName: branch, targetSha: sha, mode: mode);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(r.message)));
        ref.invalidate(commitsProvider(repo.id));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('失败: $e')));
      }
    }
  }

  static String _ago(String iso) {
    try {
      final d = DateTime.parse(iso);
      final diff = DateTime.now().difference(d);
      if (diff.inSeconds < 60) return '${diff.inSeconds}s前';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m前';
      if (diff.inHours < 24) return '${diff.inHours}h前';
      if (diff.inDays < 30) return '${diff.inDays}d前';
      return DateFormat('MM-dd').format(d);
    } catch (_) {
      return iso;
    }
  }
}

class _MiniBranchSelector extends StatelessWidget {
  const _MiniBranchSelector({
    required this.current,
    required this.branches,
    required this.tags,
    required this.onChanged,
  });
  final String current;
  final List<GitBranchEntity> branches;
  final List<GitTagEntity> tags;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      onSelected: onChanged,
      itemBuilder: (ctx) => [
        ...branches
            .map((b) => PopupMenuItem(
                  value: b.name,
                  child: Row(
                    children: [
                      const Icon(Icons.bubble_chart_outlined, size: 14),
                      const SizedBox(width: 6),
                      Text(b.name),
                      if (b.isDefault) const Text(' · 默认'),
                      const Spacer(),
                      if (b.name == current)
                        const Icon(Icons.check, size: 14),
                    ],
                  ),
                )),
        if (tags.isNotEmpty)
          const PopupMenuItem(
              enabled: false, child: Divider(height: 1)),
        ...tags
            .map((t) => PopupMenuItem(
                  value: t.name,
                  child: Row(
                    children: [
                      const Icon(Icons.sell, size: 14),
                      const SizedBox(width: 6),
                      Text(t.name),
                      const Spacer(),
                      if (t.name == current)
                        const Icon(Icons.check, size: 14),
                    ],
                  ),
                )),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
            color: Colors.black.withOpacity(.03),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: Theme.of(context).dividerColor)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.bubble_chart_outlined, size: 14),
            const SizedBox(width: 4),
            Text(current,
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'monospace')),
            const SizedBox(width: 4),
            const Icon(Icons.arrow_drop_down, size: 16),
          ],
        ),
      ),
    );
  }
}
