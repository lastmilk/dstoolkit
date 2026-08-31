// =======================================================================
// git_repo_page.dart
// Flutter 版 Git 仓库详情（多 Tab：代码 / 提交 / 分支 / 标签 / 比较 / PR / Reflog / 洞察）
// 功能完整对齐 Vue 版 GitRepoPage.vue
// =======================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../data/models/git_types.dart';
import '../providers/git_providers.dart';
import '../widgets/commit_graph_painter.dart';
import '../widgets/diff_viewer.dart';

const _tabs = [
  (icon: Icons.folder, label: '代码'),
  (icon: Icons.commit, label: '提交'),
  (icon: Icons.fork_right, label: '分支'),
  (icon: Icons.sell, label: '标签'),
  (icon: Icons.compare_arrows, label: '比较'),
  (icon: Icons.merge_type, label: 'PR'),
  (icon: Icons.history, label: 'Reflog'),
  (icon: Icons.insights, label: '洞察'),
];

class GitRepoPage extends ConsumerStatefulWidget {
  const GitRepoPage({super.key, required this.repoId, this.initialTab = 0});
  final int repoId;
  final int initialTab;

  @override
  ConsumerState<GitRepoPage> createState() => _GitRepoPageState();
}

class _GitRepoPageState extends ConsumerState<GitRepoPage>
    with SingleTickerProviderStateMixin {
  late TabController _tab;

  @override
  void initState() {
    super.initState();
    _tab = TabController(
      length: _tabs.length,
      vsync: this,
      initialIndex: widget.initialTab.clamp(0, _tabs.length - 1),
    );
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final repoAsync = ref.watch(repoProvider(widget.repoId));
    final theme = Theme.of(context);
    return DefaultTabController(
      length: _tabs.length,
      initialIndex: widget.initialTab,
      child: Scaffold(
        appBar: AppBar(
          title: repoAsync.when(
            data: (r) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      r.type == GitRepoType.CONVERSATION
                          ? Icons.forum
                          : Icons.account_tree,
                      size: 18,
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(r.name,
                          style: const TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w700),
                          overflow: TextOverflow.ellipsis),
                    ),
                  ],
                ),
                Text(
                  '🌿 ${r.branchCount} · 📦 ${r.commitCount} · 🔀 ${r.pullRequestCount ?? 0}',
                  style: TextStyle(fontSize: 10.5, color: theme.hintColor),
                ),
              ],
            ),
            loading: () => const Text('加载中...'),
            error: (e, _) => Text('加载失败 $e'),
          ),
          bottom: TabBar(
            controller: _tab,
            isScrollable: true,
            tabs: _tabs
                .map((t) => Tab(
                      iconMargin: EdgeInsets.zero,
                      icon: Icon(t.icon, size: 16),
                      text: t.label,
                      height: 58,
                    ))
                .toList(),
          ),
        ),
        body: TabBarView(
          controller: _tab,
          children: [
            _CodeTab(repoId: widget.repoId),
            _CommitsTab(repoId: widget.repoId),
            _BranchesTab(repoId: widget.repoId),
            _TagsTab(repoId: widget.repoId),
            _CompareTab(repoId: widget.repoId),
            _PRTab(repoId: widget.repoId),
            _ReflogTab(repoId: widget.repoId),
            _InsightsTab(repoId: widget.repoId),
          ],
        ),
      ),
    );
  }
}

// =======================================================================
// Tab 1: 代码（文件树 + 文件内容查看 + 快捷操作：Reset/Stash 等）
// =======================================================================
class _CodeTab extends ConsumerStatefulWidget {
  const _CodeTab({required this.repoId});
  final int repoId;
  @override
  ConsumerState<_CodeTab> createState() => _CodeTabState();
}

class _CodeTabState extends ConsumerState<_CodeTab> {
  String? _path;

  @override
  Widget build(BuildContext context) {
    final refName = ref.watch(currentRefProvider(widget.repoId));
    final branches = ref.watch(branchesProvider(widget.repoId));
    final tags = ref.watch(tagsProvider(widget.repoId));
    final filesAsync = ref.watch(treeProvider(
        (repoId: widget.repoId, ref: refName, path: _path)));

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(8),
          child: Row(
            children: [
              branches.when(
                data: (brs) => _BranchSelector(
                  current: refName,
                  branches: brs,
                  tags: tags.valueOrNull ?? const [],
                  onChanged: (v) {
                    ref
                        .read(currentRefProvider(widget.repoId).notifier)
                        .state = v;
                    setState(() => _path = null);
                  },
                  onCreateBranch: (name, base) async {
                    final api = ref.read(gitApiProvider);
                    try {
                      final br = await api.createBranch(widget.repoId,
                          name: name, fromBranchName: base);
                      ref.invalidate(branchesProvider(widget.repoId));
                      ref
                          .read(currentRefProvider(widget.repoId).notifier)
                          .state = br.name;
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('分支 ${br.name} 已创建')));
                      }
                    } catch (e) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('创建分支失败: $e')));
                      }
                    }
                  },
                ),
                loading: () => const CircularProgressIndicator(),
                error: (e, _) => Text('Error: $e'),
              ),
              const Spacer(),
              IconButton(
                  onPressed: () {
                    ref.invalidate(treeProvider);
                    ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('已刷新')));
                  },
                  icon: const Icon(Icons.refresh)),
            ],
          ),
        ),
        if (_path != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            child: InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: () => setState(() => _path = null),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                    color: Theme.of(context).dividerColor.withOpacity(.06),
                    borderRadius: BorderRadius.circular(8)),
                child: Row(
                  children: [
                    const Icon(Icons.folder, size: 14),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text('📁 根',
                          style: TextStyle(
                              color: Theme.of(context).primaryColor,
                              fontSize: 12.5)),
                    ),
                    for (var i = 0;
                        i < _path!.split('/').length;
                        i++) ...[
                      const Text(' / '),
                      Text(_path!.split('/')[i],
                          style: const TextStyle(fontSize: 12.5)),
                    ],
                  ],
                ),
              ),
            ),
          ),
        Expanded(
          child: filesAsync.when(
            data: (files) => _FileTree(
                files: files,
                onTap: (f) => setState(() => _path = f.path)),
            loading: () =>
                const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('加载失败: $e')),
          ),
        ),
        // 快速操作卡片
        _QuickOpsCard(repoId: widget.repoId, refName: refName),
      ],
    );
  }
}

class _BranchSelector extends StatefulWidget {
  const _BranchSelector({
    required this.current,
    required this.branches,
    required this.tags,
    required this.onChanged,
    required this.onCreateBranch,
  });
  final String current;
  final List<GitBranchEntity> branches;
  final List<GitTagEntity> tags;
  final ValueChanged<String> onChanged;
  final Future<void> Function(String name, String base) onCreateBranch;
  @override
  State<_BranchSelector> createState() => _BranchSelectorState();
}

class _BranchSelectorState extends State<_BranchSelector> {
  final _nameCtrl = TextEditingController();

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return PopupMenuButton<String>(
      onSelected: (v) => widget.onChanged(v),
      itemBuilder: (ctx) => [
        const PopupMenuItem<String>(
            enabled: false,
            child: Text('🌿 分支',
                style: TextStyle(fontWeight: FontWeight.w700))),
        ...widget.branches
            .map((b) => PopupMenuItem<String>(
                  value: b.name,
                  child: ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      Icons.bubble_chart_outlined,
                      size: 16,
                      color: b.name == widget.current
                          ? theme.primaryColor
                          : null,
                    ),
                    title: Row(
                      children: [
                        Text(b.name),
                        const SizedBox(width: 6),
                        if (b.isDefault)
                          _badge('默认', Colors.blue, Colors.white),
                        if (b.protectionLevel == ProtectionLevel.PROTECTED)
                          _badge('受保护', Colors.orange, Colors.white),
                        if (b.protectionLevel == ProtectionLevel.LOCKED)
                          _badge('锁定', Colors.red, Colors.white),
                      ],
                    ),
                    subtitle: Text(
                      b.headCommitSha?.substring(0, 7) ?? '—',
                      style: const TextStyle(
                          fontFamily: 'monospace', fontSize: 11),
                    ),
                    trailing:
                        b.name == widget.current ? const Icon(Icons.check, size: 16) : null,
                  ),
                )),
        const PopupMenuItem<String>(
            enabled: false,
            child: Divider(height: 1, color: Colors.grey)),
        const PopupMenuItem<String>(
            enabled: false,
            child: Text('🏷️ 标签',
                style: TextStyle(fontWeight: FontWeight.w700))),
        ...widget.tags
            .map((t) => PopupMenuItem<String>(
                  value: t.name,
                  child: ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading:
                        const Icon(Icons.sell, size: 16),
                    title: Text(t.name),
                    subtitle: Text(
                      t.targetCommitSha.substring(0, 7),
                      style: const TextStyle(
                          fontFamily: 'monospace', fontSize: 11),
                    ),
                    trailing: t.name == widget.current
                        ? const Icon(Icons.check, size: 16)
                        : null,
                  ),
                )),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          border: Border.all(color: theme.dividerColor),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.bubble_chart_outlined, size: 16),
            const SizedBox(width: 6),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 160),
              child: Text(widget.current,
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      fontFamily: 'monospace'),
                  overflow: TextOverflow.ellipsis),
            ),
            const SizedBox(width: 6),
            const Icon(Icons.arrow_drop_down, size: 18),
            const SizedBox(width: 8),
            InkWell(
              onTap: _openNewBranch,
              borderRadius: BorderRadius.circular(6),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: theme.primaryColor.withOpacity(.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text('+ 新建分支',
                    style: TextStyle(
                        color: theme.primaryColor,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _badge(String t, Color bg, Color fg) => Container(
        margin: const EdgeInsets.only(left: 4),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(t,
            style: TextStyle(
                fontSize: 9.5, color: fg, fontWeight: FontWeight.w700)),
      );

  void _openNewBranch() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('新建分支'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('基于当前分支创建:'),
            const SizedBox(height: 6),
            Text(widget.current,
                style: const TextStyle(
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            TextField(
              controller: _nameCtrl,
              decoration: const InputDecoration(
                labelText: '新分支名',
                border: OutlineInputBorder(),
                hintText: 'feature/xxx',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('取消')),
          FilledButton(
            onPressed: () async {
              final name = _nameCtrl.text.trim();
              if (name.isEmpty) return;
              Navigator.of(ctx).pop();
              await widget.onCreateBranch(name, widget.current);
              _nameCtrl.clear();
            },
            child: const Text('创建'),
          ),
        ],
      ),
    );
  }
}

// ===== File Tree =====
class _FileTree extends StatelessWidget {
  const _FileTree({required this.files, required this.onTap});
  final List<TreeFileItem> files;
  final ValueChanged<TreeFileItem> onTap;

  @override
  Widget build(BuildContext context) {
    if (files.isEmpty) {
      return const Center(child: Text('空目录'));
    }
    // Group by first path segment
    final groups = <String, List<TreeFileItem>>{};
    for (final f in files) {
      final parts = f.path.split('/');
      final top = parts.first;
      groups.putIfAbsent(top, () => []).add(f);
    }
    final entries = groups.entries.toList()
      ..sort((a, b) {
        final aDir = a.value.length > 1 || a.value.first.path != a.key;
        final bDir = b.value.length > 1 || b.value.first.path != b.key;
        if (aDir != bDir) return aDir ? -1 : 1;
        return a.key.compareTo(b.key);
      });

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      itemCount: entries.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (ctx, i) {
        final e = entries[i];
        final isDir = e.value.length > 1 || e.value.first.path != e.key;
        final only = e.value.singleOrNull;
        final size = isDir
            ? e.value.fold<int>(0, (acc, f) => acc + f.sizeBytes)
            : only?.sizeBytes ?? 0;
        return ListTile(
          onTap: () {
            if (isDir) {
              onTap(e.value.first.path.substring(
                  0,
                  e.value.first.path.indexOf('/') > 0
                      ? e.value.first.path.indexOf('/')
                      : e.value.first.path.length));
              // open as prefix
              // actually onTap opens the file path. For dir we need a path prefix match, but our backend supports prefix listing.
              // Simpler: create first directory path.
              final first = e.key;
              final dirPath = e.value
                  .firstWhere((x) => x.path.startsWith('$first/'),
                      orElse: () => e.value.first)
                  .path;
              final slash = dirPath.indexOf('/');
              onTap(TreeFileItem(
                  path: slash > 0 ? dirPath.substring(0, slash) : first,
                  blobId: 0,
                  sha: '',
                  sizeBytes: 0));
            } else {
              onTap(e.value.first);
            }
          },
          leading: Icon(isDir ? Icons.folder : Icons.insert_drive_file,
              color: isDir ? Colors.amber[700] : Colors.grey[600]),
          title: Text(e.key,
              style: const TextStyle(
                  fontFamily: 'monospace', fontSize: 13)),
          subtitle: !isDir && only != null
              ? Text(
                  '${only.sha.substring(0, 7)} · ${only.mimeType}',
                  style: const TextStyle(
                      fontFamily: 'monospace', fontSize: 10.5),
                )
              : null,
          trailing: Text(_fmtSize(size),
              style: const TextStyle(
                  fontFamily: 'monospace', fontSize: 11, color: Colors.grey)),
        );
      },
    );
  }

  static String _fmtSize(int b) {
    if (b < 1024) return '${b}B';
    if (b < 1024 * 1024) return '${(b / 1024).toStringAsFixed(1)}KB';
    return '${(b / 1024 / 1024).toStringAsFixed(2)}MB';
  }
}

// ===== Quick Operations =====
class _QuickOpsCard extends ConsumerStatefulWidget {
  const _QuickOpsCard({required this.repoId, required this.refName});
  final int repoId;
  final String refName;
  @override
  ConsumerState<_QuickOpsCard> createState() => _QuickOpsCardState();
}

class _QuickOpsCardState extends ConsumerState<_QuickOpsCard> {
  final _shaCtrl = TextEditingController();
  final _stashCtrl = TextEditingController();
  var _resetMode = ResetMode.MIXED;

  @override
  void dispose() {
    _shaCtrl.dispose();
    _stashCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      margin: const EdgeInsets.all(8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        border: Border.all(color: theme.dividerColor),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('⚡ 快速操作（版本控制）',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _shaCtrl,
                  style: const TextStyle(
                      fontFamily: 'monospace', fontSize: 12.5),
                  decoration: const InputDecoration(
                    isDense: true,
                    hintText: 'Commit SHA（重置目标）',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(
                        horizontal: 8, vertical: 8),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              DropdownButtonHideUnderline(
                child: DropdownButton<ResetMode>(
                    value: _resetMode,
                    items: const [
                      DropdownMenuItem(
                          value: ResetMode.MIXED, child: Text('MIXED')),
                      DropdownMenuItem(
                          value: ResetMode.SOFT, child: Text('SOFT')),
                      DropdownMenuItem(
                          value: ResetMode.HARD, child: Text('HARD')),
                    ],
                    onChanged: (v) => setState(() => _resetMode = v!)),
              ),
              const SizedBox(width: 4),
              FilledButton.tonalIcon(
                onPressed: _reset,
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Reset'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _stashCtrl,
                  decoration: const InputDecoration(
                    isDense: true,
                    hintText: 'Stash 备注（可选）',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(
                        horizontal: 8, vertical: 8),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              TextButton.icon(
                onPressed: _stash,
                icon: const Icon(Icons.save, size: 16),
                label: const Text('Stash'),
              ),
              TextButton.icon(
                onPressed: _stashPop,
                icon: const Icon(Icons.upload, size: 16),
                label: const Text('Pop'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _reset() async {
    final sha = _shaCtrl.text.trim();
    if (sha.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('执行 Reset'),
        content: Text(
            '将 ${widget.refName} reset --${_resetMode.name.toLowerCase()} 到 ${sha.substring(0, 7)}？'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('取消')),
          FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('确认')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final r = await ref.read(gitApiProvider).reset(widget.repoId,
          branchName: widget.refName, targetSha: sha, mode: _resetMode);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(r.message)));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Reset 失败: $e')));
      }
    }
  }

  Future<void> _stash() async {
    try {
      final r = await ref.read(gitApiProvider).stash(
            widget.repoId,
            branchName: widget.refName,
            message: _stashCtrl.text.isEmpty ? null : _stashCtrl.text.trim(),
          );
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(r.message)));
      }
      _stashCtrl.clear();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Stash 失败: $e')));
      }
    }
  }

  Future<void> _stashPop() async {
    try {
      final r = await ref.read(gitApiProvider).stashPop(widget.repoId);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(r.message)));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Stash Pop 失败: $e')));
      }
    }
  }
}

// =======================================================================
// Tab 2: 提交（DAG 图 + 列表 + 详情 + Cherry / Revert / Reset）
// =======================================================================
class _CommitsTab extends ConsumerStatefulWidget {
  const _CommitsTab({required this.repoId});
  final int repoId;
  @override
  ConsumerState<_CommitsTab> createState() => _CommitsTabState();
}

class _CommitsTabState extends ConsumerState<_CommitsTab> {
  String? _selectedSha;

  @override
  Widget build(BuildContext context) {
    final commitsAsync = ref.watch(commitsProvider(widget.repoId));
    final theme = Theme.of(context);
    return commitsAsync.when(
      data: (commits) {
        final info = computeLayout(commits);
        final graphWidth = 8.0 + info.laneCount * 18.0;
        final graphHeight = commits.length * 44.0;
        return Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(8),
                child: commits.isEmpty
                    ? const Center(child: Text('暂无提交'))
                    : Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: graphWidth,
                            height: graphHeight,
                            child: CustomPaint(
                              painter: CommitGraphPainter(info: info),
                              size: Size(graphWidth, graphHeight),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Column(
                              children: [
                                for (var i = 0;
                                    i < info.rows.length;
                                    i++)
                                  _commitItem(context, info.rows[i].commit, i),
                              ],
                            ),
                          ),
                        ],
                      ),
              ),
            ),
            if (_selectedSha != null)
              _CommitDetailBar(
                repoId: widget.repoId,
                sha: _selectedSha!,
                onClose: () => setState(() => _selectedSha = null),
                onCherry: (sha) => _cherry(sha),
                onRevert: (sha) => _revert(sha),
                onReset: (sha) {
                  setState(() => _selectedSha = null);
                  // 找到 parent _CodeTab 里的 _shaCtrl — 简化：直接 Snackbar 提示
                  ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('已复制 SHA: $sha (前往"代码"Tab → 快速 Reset)')));
                },
              ),
          ],
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
    );
  }

  Widget _commitItem(BuildContext context, GitCommitEntity c, int index) {
    final selected = _selectedSha == c.sha256;
    final theme = Theme.of(context);
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
      'EDIT': '编辑',
    };
    return InkWell(
      onTap: () => setState(() => _selectedSha = c.sha256),
      child: Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 6),
        decoration: BoxDecoration(
          color: selected
              ? theme.primaryColor.withOpacity(.1)
              : Colors.transparent,
          border: selected
              ? Border.all(color: theme.primaryColor)
              : Border.all(color: Colors.transparent),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              children: [
                if (c.changeType != null)
                  Container(
                    margin: const EdgeInsets.only(right: 6),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 1),
                    decoration: BoxDecoration(
                      color: theme.primaryColor.withOpacity(.12),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                        changeLabels[c.changeType] ?? c.changeType!,
                        style: TextStyle(
                            fontSize: 9.5,
                            color: theme.primaryColor,
                            fontWeight: FontWeight.w700)),
                  ),
                Expanded(
                  child: Text(
                    c.subject,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 12.5, fontWeight: FontWeight.w600),
                  ),
                ),
                const SizedBox(width: 6),
                Text('+${c.additions}',
                    style: TextStyle(
                        color: Colors.green[700],
                        fontSize: 11,
                        fontWeight: FontWeight.w700)),
                const SizedBox(width: 4),
                Text('-${c.deletions}',
                    style: TextStyle(
                        color: Colors.red[700],
                        fontSize: 11,
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
                const SizedBox(width: 8),
                Text(c.authorName,
                    style: const TextStyle(
                        fontSize: 10.5, color: Colors.black54)),
                const SizedBox(width: 8),
                Text(_ago(c.committedAt),
                    style: const TextStyle(
                        fontSize: 10.5, color: Colors.black45)),
                if (c.isMerge)
                  Container(
                    margin: const EdgeInsets.only(left: 8),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 1),
                    decoration: BoxDecoration(
                        color: Colors.purple.withOpacity(.12),
                        borderRadius: BorderRadius.circular(4)),
                    child: const Text('合并提交',
                        style: TextStyle(
                            fontSize: 9.5,
                            color: Colors.purple,
                            fontWeight: FontWeight.w700)),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _cherry(String sha) async {
    final branch = ref.read(currentRefProvider(widget.repoId));
    try {
      final r = await ref
          .read(gitApiProvider)
          .cherryPick(widget.repoId, sha: sha, ontoBranchName: branch);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(r.message)));
        ref.invalidate(commitsProvider(widget.repoId));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Cherry-pick 失败: $e')));
      }
    }
  }

  Future<void> _revert(String sha) async {
    final branch = ref.read(currentRefProvider(widget.repoId));
    try {
      final r = await ref
          .read(gitApiProvider)
          .revert(widget.repoId, sha: sha, ontoBranchName: branch);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(r.message)));
        ref.invalidate(commitsProvider(widget.repoId));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Revert 失败: $e')));
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

class _CommitDetailBar extends ConsumerStatefulWidget {
  const _CommitDetailBar({
    required this.repoId,
    required this.sha,
    required this.onClose,
    required this.onCherry,
    required this.onRevert,
    required this.onReset,
  });
  final int repoId;
  final String sha;
  final VoidCallback onClose;
  final ValueChanged<String> onCherry;
  final ValueChanged<String> onRevert;
  final ValueChanged<String> onReset;
  @override
  ConsumerState<_CommitDetailBar> createState() => _CommitDetailBarState();
}

class _CommitDetailBarState extends ConsumerState<_CommitDetailBar> {
  var _mode = DiffViewMode.split;
  @override
  Widget build(BuildContext context) {
    final detailAsync = ref.watch(commitDetailProvider(
        (repoId: widget.repoId, sha: widget.sha)));
    return Container(
      constraints: const BoxConstraints(maxHeight: 360),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Theme.of(context).dividerColor)),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            color: Theme.of(context).dividerColor.withOpacity(.06),
            child: Row(
              children: [
                const Icon(Icons.commit, size: 16),
                const SizedBox(width: 6),
                Expanded(
                  child: detailAsync.when(
                    data: (d) => Text(
                      d.commit.subject,
                      style: const TextStyle(
                          fontSize: 12.5, fontWeight: FontWeight.w700),
                      overflow: TextOverflow.ellipsis,
                    ),
                    loading: () => const Text('加载中...'),
                    error: (e, _) => Text('错误: $e'),
                  ),
                ),
                SegmentedButton<DiffViewMode>(
                  segments: const [
                    ButtonSegment(value: DiffViewMode.split, label: Text('Split')),
                    ButtonSegment(value: DiffViewMode.unified, label: Text('Unified')),
                  ],
                  selected: {_mode},
                  onSelectionChanged: (s) => setState(() => _mode = s.first),
                ),
                IconButton(
                    onPressed: () => widget.onReset(widget.sha),
                    tooltip: '用此SHA做Reset',
                    icon: const Icon(Icons.settings_backup_restore, size: 18)),
                IconButton(
                    onPressed: () => widget.onCherry(widget.sha),
                    tooltip: 'Cherry-pick',
                    icon: const Icon(Icons.content_copy, size: 18)),
                IconButton(
                    onPressed: () => widget.onRevert(widget.sha),
                    tooltip: 'Revert',
                    icon: const Icon(Icons.undo, size: 18)),
                IconButton(
                    onPressed: widget.onClose,
                    icon: const Icon(Icons.close, size: 18)),
              ],
            ),
          ),
          Expanded(
            child: detailAsync.when(
              data: (d) => ListView.builder(
                padding: const EdgeInsets.all(8),
                itemCount: d.diff.files.length + 1,
                itemBuilder: (ctx, i) {
                  if (i == 0) {
                    final c = d.commit;
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                            color: Theme.of(context).dividerColor),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '📁 ${d.diff.files.length} files · +${d.diff.additions} -${d.diff.deletions}',
                            style: const TextStyle(
                                fontFamily: 'monospace', fontSize: 12),
                          ),
                          const SizedBox(height: 4),
                          Text(
                              '${c.sha256.substring(0, 10)} · ${c.authorName} · ${c.committedAt}',
                              style: const TextStyle(
                                  fontFamily: 'monospace',
                                  fontSize: 11,
                                  color: Colors.black54)),
                        ],
                      ),
                    );
                  }
                  return DiffFileViewer(
                      file: d.diff.files[i - 1], viewMode: _mode);
                },
              ),
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
            ),
          ),
        ],
      ),
    ),
  }
}

// =======================================================================
// Tab 3: 分支列表
// =======================================================================
class _BranchesTab extends ConsumerWidget {
  const _BranchesTab({required this.repoId});
  final int repoId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branchesAsync = ref.watch(branchesProvider(repoId));
    return branchesAsync.when(
      data: (brs) => ListView.separated(
        padding: const EdgeInsets.all(8),
        itemCount: brs.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (ctx, i) {
          final b = brs[i];
          return ListTile(
            tileColor: Colors.white,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: BorderSide(color: Theme.of(context).dividerColor)),
            leading: const Icon(Icons.bubble_chart_outlined),
            title: Row(
              children: [
                Text(b.name,
                    style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 13,
                        fontWeight: FontWeight.w700)),
                const SizedBox(width: 6),
                if (b.isDefault)
                  _label('默认', Colors.blue),
                if (b.protectionLevel == ProtectionLevel.PROTECTED)
                  _label('受保护', Colors.orange),
                if (b.protectionLevel == ProtectionLevel.LOCKED)
                  _label('锁定', Colors.red),
              ],
            ),
            subtitle: Text(
                '${b.headCommitSha?.substring(0, 8) ?? '—'} · ${b.commitCount} commits · ${b.updatedAt}',
                style: const TextStyle(
                    fontFamily: 'monospace', fontSize: 11)),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextButton(
                    onPressed: () {
                      ref
                          .read(currentRefProvider(repoId).notifier)
                          .state = b.name;
                      ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
                          content: Text('已切换: ${b.name} (前往代码/提交Tab查看)')));
                    },
                    child: const Text('检出')),
                TextButton(
                    onPressed: b.isDefault
                        ? null
                        : () async {
                            final ok = await showDialog<bool>(
                              context: ctx,
                              builder: (c) => AlertDialog(
                                title: Text('删除分支 ${b.name}？'),
                                actions: [
                                  TextButton(
                                      onPressed: () =>
                                          Navigator.of(c).pop(false),
                                      child: const Text('取消')),
                                  FilledButton(
                                      onPressed: () =>
                                          Navigator.of(c).pop(true),
                                      child: const Text('删除')),
                                ],
                              ),
                            );
                            if (ok != true) return;
                            try {
                              await ref
                                  .read(gitApiProvider)
                                  .deleteBranch(repoId, b.name);
                              if (ctx.mounted) {
                                ScaffoldMessenger.of(ctx).showSnackBar(
                                    SnackBar(
                                        content: Text('${b.name} 已删除')));
                              }
                              ref.invalidate(branchesProvider(repoId));
                            } catch (e) {
                              if (ctx.mounted) {
                                ScaffoldMessenger.of(ctx).showSnackBar(
                                    SnackBar(content: Text('删除失败: $e')));
                              }
                            }
                          },
                    child: const Text('删除')),
              ],
            ),
          );
        },
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
    );
  }

  Widget _label(String t, Color c) => Container(
        margin: const EdgeInsets.only(right: 4),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
        decoration: BoxDecoration(
            color: c.withOpacity(.15),
            borderRadius: BorderRadius.circular(999)),
        child: Text(t,
            style: TextStyle(
                color: c, fontSize: 9.5, fontWeight: FontWeight.w700)),
      );
}

// =======================================================================
// Tab 4: 标签
// =======================================================================
class _TagsTab extends ConsumerStatefulWidget {
  const _TagsTab({required this.repoId});
  final int repoId;
  @override
  ConsumerState<_TagsTab> createState() => _TagsTabState();
}

class _TagsTabState extends ConsumerState<_TagsTab> {
  final _nameCtrl = TextEditingController();
  final _shaCtrl = TextEditingController();
  final _titleCtrl = TextEditingController();
  @override
  void dispose() {
    _nameCtrl.dispose();
    _shaCtrl.dispose();
    _titleCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tagsAsync = ref.watch(tagsProvider(widget.repoId));
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(8),
          child: FilledButton.icon(
              onPressed: _openNew,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('新建标签')),
        ),
        Expanded(
          child: tagsAsync.when(
            data: (tags) => ListView.separated(
              padding: const EdgeInsets.all(8),
              itemCount: tags.length,
              separatorBuilder: (_, __) => const SizedBox(height: 6),
              itemBuilder: (ctx, i) {
                final t = tags[i];
                return ListTile(
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                      side: BorderSide(
                          color: Theme.of(context).dividerColor)),
                  leading: const Icon(Icons.sell),
                  title: Row(
                    children: [
                      Text(t.name,
                          style: const TextStyle(
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.w700)),
                      const SizedBox(width: 6),
                      Text(t.type,
                          style: TextStyle(
                              fontSize: 9.5,
                              color: Theme.of(context).primaryColor)),
                    ],
                  ),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if ((t.title ?? '').isNotEmpty)
                        Text(t.title!, style: const TextStyle(fontSize: 12)),
                      Text(
                          '${t.targetCommitSha.substring(0, 8)} · ${t.creatorName} · ${t.createdAt}',
                          style: const TextStyle(
                              fontFamily: 'monospace', fontSize: 11)),
                    ],
                  ),
                  trailing: TextButton(
                    onPressed: () async {
                      final ok = await showDialog<bool>(
                        context: ctx,
                        builder: (c) => AlertDialog(
                          title: Text('删除标签 ${t.name}？'),
                          actions: [
                            TextButton(
                                onPressed: () => Navigator.of(c).pop(false),
                                child: const Text('取消')),
                            FilledButton(
                                onPressed: () => Navigator.of(c).pop(true),
                                child: const Text('删除')),
                          ],
                        ),
                      );
                      if (ok != true) return;
                      try {
                        await ref
                            .read(gitApiProvider)
                            .deleteTag(widget.repoId, t.name);
                        if (ctx.mounted) {
                          ScaffoldMessenger.of(ctx).showSnackBar(
                              SnackBar(content: Text('${t.name} 已删除')));
                        }
                        ref.invalidate(tagsProvider(widget.repoId));
                      } catch (e) {
                        if (ctx.mounted) {
                          ScaffoldMessenger.of(ctx).showSnackBar(
                              SnackBar(content: Text('失败: $e')));
                        }
                      }
                    },
                    child: const Text('删除'),
                  ),
                );
              },
            ),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('Error: $e')),
          ),
        ),
      ],
    );
  }

  void _openNew() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('新建 Tag'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
                controller: _nameCtrl,
                decoration: const InputDecoration(
                    labelText: '标签名 *', border: OutlineInputBorder()),
                style: const TextStyle(fontFamily: 'monospace')),
            const SizedBox(height: 8),
            TextField(
                controller: _shaCtrl,
                decoration: const InputDecoration(
                    labelText: '目标 commit SHA',
                    hintText: '空=默认分支head',
                    border: OutlineInputBorder()),
                style: const TextStyle(fontFamily: 'monospace')),
            const SizedBox(height: 8),
            TextField(
                controller: _titleCtrl,
                decoration: const InputDecoration(
                    labelText: '标题（可选）',
                    border: OutlineInputBorder())),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('取消')),
          FilledButton(onPressed: _submit, child: const Text('创建')),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    try {
      final t = await ref.read(gitApiProvider).createTag(
            widget.repoId,
            name: _nameCtrl.text.trim(),
            targetCommitSha:
                _shaCtrl.text.trim().isEmpty ? 'HEAD' : _shaCtrl.text.trim(),
            title:
                _titleCtrl.text.trim().isEmpty ? null : _titleCtrl.text.trim(),
          );
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Tag ${t.name} 已创建')));
        ref.invalidate(tagsProvider(widget.repoId));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('失败: $e')));
      }
    }
  }
}

// =======================================================================
// Tab 5: Compare 比较
// =======================================================================
class _CompareTab extends ConsumerStatefulWidget {
  const _CompareTab({required this.repoId});
  final int repoId;
  @override
  ConsumerState<_CompareTab> createState() => _CompareTabState();
}

class _CompareTabState extends ConsumerState<_CompareTab> {
  var _mode = DiffViewMode.split;
  var _strategy = MergeStrategy.THREE_WAY;

  @override
  Widget build(BuildContext context) {
    final refs = ref.watch(compareRefsProvider(widget.repoId));
    final branches = ref.watch(branchesProvider(widget.repoId)).valueOrNull ?? const [];
    final tags = ref.watch(tagsProvider(widget.repoId)).valueOrNull ?? const [];
    final cmp = ref.watch(compareProvider(widget.repoId));
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Container(
            margin: const EdgeInsets.all(8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Theme.of(context).dividerColor)),
            child: Column(
              children: [
                Row(
                  children: [
                    const Text('Base: '),
                    const SizedBox(width: 6),
                    Expanded(
                      child: _refDropdown(
                        value: refs.base,
                        branches: branches,
                        tags: tags,
                        onChanged: (v) {
                          ref
                              .read(compareRefsProvider(widget.repoId)
                                  .notifier)
                              .state = refs.copyWith(base: v);
                        },
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Icon(Icons.compare_arrows),
                    const SizedBox(width: 6),
                    const Text('Head: '),
                    const SizedBox(width: 6),
                    Expanded(
                      child: _refDropdown(
                        value: refs.head,
                        branches: branches,
                        tags: tags,
                        onChanged: (v) {
                          ref
                              .read(compareRefsProvider(widget.repoId)
                                  .notifier)
                              .state = refs.copyWith(head: v);
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                cmp.when(
                  data: (d) => d == null
                      ? const Text('请选择 Base 和 Head')
                      : _compareSummary(d),
                  loading: () => const Text('比较中...'),
                  error: (e, _) => Text('比较失败: $e',
                      style: const TextStyle(color: Colors.red)),
                ),
              ],
            ),
          ),
        ),
        if (cmp.value != null)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  SegmentedButton<DiffViewMode>(
                    segments: const [
                      ButtonSegment(value: DiffViewMode.split, label: Text('Split')),
                      ButtonSegment(value: DiffViewMode.unified, label: Text('Unified')),
                    ],
                    selected: {_mode},
                    onSelectionChanged: (s) => setState(() => _mode = s.first),
                  ),
                  const Spacer(),
                  DropdownButton<MergeStrategy>(
                      value: _strategy,
                      items: MergeStrategy.values
                          .map((s) => DropdownMenuItem(
                              value: s,
                              child: Text(
                                switch (s) {
                                  MergeStrategy.FAST_FORWARD_ONLY => 'FF only',
                                  MergeStrategy.THREE_WAY => 'Three Way',
                                  MergeStrategy.SQUASH => 'Squash',
                                  MergeStrategy.REBASE => 'Rebase',
                                  MergeStrategy.OURS => 'Ours',
                                  MergeStrategy.THEIRS => 'Theirs',
                                },
                              )))
                          .toList(),
                      onChanged: (s) => setState(() => _strategy = s!)),
                  const SizedBox(width: 8),
                  FilledButton.tonalIcon(
                    onPressed: cmp.value?.mergeable ?? false ? _merge : null,
                    icon: const Icon(Icons.merge_type),
                    label: Text('合并 ${refs.head} → ${refs.base}'),
                  ),
                ],
              ),
            ),
          ),
        if (cmp.value != null)
          SliverPadding(
            padding: const EdgeInsets.all(8),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) => DiffFileViewer(
                    file: cmp.value!.files[i], viewMode: _mode),
                childCount: cmp.value!.files.length,
              ),
            ),
          ),
      ],
    );
  }

  Widget _refDropdown({
    required String value,
    required List<GitBranchEntity> branches,
    required List<GitTagEntity> tags,
    required ValueChanged<String> onChanged,
  }) {
    return DropdownButtonFormField<String>(
      isExpanded: true,
      value: value.isEmpty ? null : value,
      decoration: const InputDecoration(
        isDense: true,
        contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        border: OutlineInputBorder(),
      ),
      items: [
        ...branches
            .map((b) => DropdownMenuItem(value: b.name, child: Text('🌿 ${b.name}'))),
        ...tags
            .map((t) => DropdownMenuItem(value: t.name, child: Text('🏷️ ${t.name}'))),
      ],
      onChanged: (v) => onChanged(v ?? ''),
    );
  }

  Widget _compareSummary(CompareResponse d) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        color: d.mergeable
            ? Colors.green.withOpacity(.08)
            : Colors.red.withOpacity(.08),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                d.mergeable ? '✅ 可合并' : '⚠️ 有冲突（${d.conflictFiles.length}）',
                style: TextStyle(
                    color: d.mergeable ? Colors.green[800] : Colors.red[800],
                    fontWeight: FontWeight.w700),
              ),
              const Spacer(),
              Text('📦 ${d.commitsBehind}↓ / ${d.commitsAhead}↑'),
              const SizedBox(width: 8),
              Text('📁 ${d.files.length}',
                  style: const TextStyle(fontFamily: 'monospace')),
              const SizedBox(width: 8),
              Text('+${d.additions}',
                  style: TextStyle(
                      color: Colors.green[700], fontWeight: FontWeight.w700)),
              const SizedBox(width: 6),
              Text('-${d.deletions}',
                  style: TextStyle(
                      color: Colors.red[700], fontWeight: FontWeight.w700)),
            ],
          ),
          if (d.conflictFiles.isNotEmpty) ...[
            const SizedBox(height: 6),
            const Text('冲突文件：',
                style: TextStyle(fontWeight: FontWeight.w600)),
            ...d.conflictFiles.map((f) => Text('  · $f',
                style: const TextStyle(
                    fontFamily: 'monospace', fontSize: 11.5))),
          ],
        ],
      ),
    );
  }

  Future<void> _merge() async {
    final refs = ref.read(compareRefsProvider(widget.repoId));
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('执行合并'),
        content: Text(
            '策略 ${_strategy.name}：${refs.head} → ${refs.base}'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(c).pop(false),
              child: const Text('取消')),
          FilledButton(
              onPressed: () => Navigator.of(c).pop(true),
              child: const Text('确认')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final r = await ref.read(gitApiProvider).merge(
            widget.repoId,
            baseBranchName: refs.base,
            headBranchName: refs.head,
            strategy: _strategy,
          );
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(r.message)));
        ref.invalidate(compareProvider(widget.repoId));
        ref.invalidate(commitsProvider(widget.repoId));
        ref.invalidate(branchesProvider(widget.repoId));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('合并失败: $e')));
      }
    }
  }
}

// =======================================================================
// Tab 6: PR 列表 + 详情抽屉
// =======================================================================
class _PRTab extends ConsumerStatefulWidget {
  const _PRTab({required this.repoId});
  final int repoId;
  @override
  ConsumerState<_PRTab> createState() => _PRTabState();
}

class _PRTabState extends ConsumerState<_PRTab> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _head = '';
  String _base = '';

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final statuses = <PullRequestStatus?>[
      null,
      PullRequestStatus.OPEN,
      PullRequestStatus.REVIEW,
      PullRequestStatus.APPROVED,
      PullRequestStatus.CHANGES_REQUESTED,
      PullRequestStatus.MERGED,
      PullRequestStatus.CLOSED,
      PullRequestStatus.DRAFT,
    ];
    final labels = {
      null: '全部',
      PullRequestStatus.OPEN: '🟢 待审',
      PullRequestStatus.REVIEW: '🔍 审核中',
      PullRequestStatus.APPROVED: '✅ 已批',
      PullRequestStatus.CHANGES_REQUESTED: '🟡 待改',
      PullRequestStatus.MERGED: '🟣 已合并',
      PullRequestStatus.CLOSED: '⚫ 已关',
      PullRequestStatus.DRAFT: '📝 草稿',
    };
    final currentStatus = ref.watch(prStatusFilterProvider);
    final prs = ref.watch(prListProvider(widget.repoId));
    final branches = ref.watch(branchesProvider(widget.repoId)).valueOrNull ?? const [];
    if (_base.isEmpty && branches.isNotEmpty) {
      _base = branches.firstWhere((b) => b.isDefault, orElse: () => branches.first).name;
      if (_head.isEmpty) _head = _base;
    }
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(8),
          child: Column(
            children: [
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: statuses
                    .map((s) => ChoiceChip(
                          label: Text(labels[s]!,
                              style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: currentStatus == s
                                      ? FontWeight.w700
                                      : FontWeight.w500)),
                          selected: currentStatus == s,
                          onSelected: (_) => ref
                              .read(prStatusFilterProvider.notifier)
                              .state = s,
                        ))
                    .toList(),
              ),
              const SizedBox(height: 8),
              FilledButton.icon(
                onPressed: branches.isEmpty ? null : _openNewPR,
                icon: const Icon(Icons.add, size: 18),
                label: const Text('新建 PR'),
              ),
            ],
          ),
        ),
        Expanded(
          child: prs.when(
            data: (list) => list.isEmpty
                ? const Center(child: Text('暂无 PR'))
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
                    itemCount: list.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: 8),
                    itemBuilder: (ctx, i) {
                      final pr = list[i];
                      return _PRCard(
                        pr: pr,
                        repoId: widget.repoId,
                        onOpen: () => _openDetail(pr),
                      );
                    },
                  ),
            loading: () =>
                const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('Error: $e')),
          ),
        ),
      ],
    );
  }

  void _openNewPR() {
    final branches =
        ref.watch(branchesProvider(widget.repoId)).valueOrNull ?? const [];
    final brList = branches
        .map((b) => DropdownMenuItem(value: b.name, child: Text(b.name)))
        .toList();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 16, right: 16, top: 8,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
        ),
        child: StatefulBuilder(builder: (ctx, setST) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('新建合并请求',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 10),
              Row(
                children: [
                  const Text('源: '),
                  const SizedBox(width: 6),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: brList.any((e) => e.value == _head) ? _head : null,
                      items: brList,
                      decoration: const InputDecoration(
                          isDense: true, border: OutlineInputBorder()),
                      onChanged: (v) => setST(() => _head = v ?? ''),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(Icons.arrow_forward),
                  const SizedBox(width: 8),
                  const Text('目: '),
                  const SizedBox(width: 6),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: brList.any((e) => e.value == _base) ? _base : null,
                      items: brList,
                      decoration: const InputDecoration(
                          isDense: true, border: OutlineInputBorder()),
                      onChanged: (v) => setST(() => _base = v ?? ''),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                  controller: _titleCtrl,
                  decoration: const InputDecoration(
                      labelText: '标题 *', border: OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(
                  controller: _descCtrl,
                  maxLines: 4,
                  decoration: const InputDecoration(
                      labelText: '描述',
                      alignLabelWithHint: true,
                      border: OutlineInputBorder())),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _head.isEmpty || _base.isEmpty || _titleCtrl.text.trim().isEmpty
                      ? null
                      : () {
                          Navigator.of(ctx).pop();
                          _submitPR();
                        },
                  child: const Text('创建 PR'),
                ),
              ),
            ],
          );
        }),
      ),
    );
  }

  Future<void> _submitPR() async {
    try {
      final pr = await ref.read(gitApiProvider).createPR(
            widget.repoId,
            headBranchName: _head,
            baseBranchName: _base,
            title: _titleCtrl.text.trim(),
            description:
                _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('PR #${pr.number} 已创建')));
        ref.invalidate(prListProvider(widget.repoId));
      }
      _titleCtrl.clear();
      _descCtrl.clear();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('创建失败: $e')));
      }
    }
  }

  void _openDetail(PullRequestEntity pr) {
    ref.read(selectedPRProvider.notifier).state = pr;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _PRDetailSheet(
          repoId: widget.repoId,
          onChanged: () => ref.invalidate(prListProvider(widget.repoId))),
    );
  }
}

class _PRCard extends StatelessWidget {
  const _PRCard({
    required this.pr,
    required this.repoId,
    required this.onOpen,
  });
  final PullRequestEntity pr;
  final int repoId;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final statusStyle = switch (pr.status) {
      PullRequestStatus.OPEN => (Colors.green[100]!, Colors.green[800]!, '🟢 待审'),
      PullRequestStatus.REVIEW => (Colors.cyan[100]!, Colors.cyan[800]!, '🔍 审核中'),
      PullRequestStatus.APPROVED => (Colors.green[200]!, Colors.green[900]!, '✅ 已批'),
      PullRequestStatus.CHANGES_REQUESTED => (Colors.orange[100]!, Colors.orange[800]!, '🟡 待改'),
      PullRequestStatus.MERGED => (Colors.purple[100]!, Colors.purple[800]!, '🟣 已合并'),
      PullRequestStatus.CLOSED => (Colors.red[100]!, Colors.red[800]!, '⚫ 已关'),
      PullRequestStatus.DRAFT => (Colors.grey[200]!, Colors.grey[700]!, '📝 草稿'),
    };
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onOpen,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Theme.of(context).dividerColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                      color: statusStyle.$1,
                      borderRadius: BorderRadius.circular(999)),
                  child: Text(statusStyle.$3,
                      style: TextStyle(
                          color: statusStyle.$2,
                          fontWeight: FontWeight.w700,
                          fontSize: 10.5)),
                ),
                const SizedBox(width: 6),
                Text('#${pr.number}',
                    style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: Theme.of(context).primaryColor,
                        fontWeight: FontWeight.w700)),
                const SizedBox(width: 8),
                Expanded(
                    child: Text(pr.title,
                        style: const TextStyle(
                            fontSize: 13.5, fontWeight: FontWeight.w700),
                        overflow: TextOverflow.ellipsis)),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(Icons.fork_right, size: 12, color: Colors.green[700]),
                const SizedBox(width: 3),
                Text(pr.headBranchName,
                    style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 11.5,
                        color: Colors.green[800],
                        fontWeight: FontWeight.w600)),
                const SizedBox(width: 6),
                const Icon(Icons.arrow_forward, size: 12),
                const SizedBox(width: 6),
                Icon(Icons.merge_type, size: 12, color: Colors.blue[700]),
                const SizedBox(width: 3),
                Text(pr.baseBranchName,
                    style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 11.5,
                        color: Colors.blue[800],
                        fontWeight: FontWeight.w600)),
              ],
            ),
            if ((pr.description ?? '').isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(pr.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 12, color: Theme.of(context).hintColor)),
              ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 12,
              children: [
                Text('👤 ${pr.authorName}',
                    style: const TextStyle(fontSize: 11.5, color: Colors.black54)),
                Text(pr.createdAt.toString().substring(0, 16),
                    style: const TextStyle(fontSize: 11.5, color: Colors.black45)),
                Text('💬 ${pr.commentCount ?? 0}',
                    style: const TextStyle(fontSize: 11.5, color: Colors.black54)),
                Text('📦 ${pr.commitsAhead ?? 0}',
                    style: const TextStyle(fontSize: 11.5, color: Colors.black54)),
                Text('+${pr.additions ?? 0}',
                    style: TextStyle(
                        color: Colors.green[700],
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700)),
                Text('-${pr.deletions ?? 0}',
                    style: TextStyle(
                        color: Colors.red[700],
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700)),
                Text('📁 ${pr.changedFiles ?? 0}',
                    style: const TextStyle(fontSize: 11.5, color: Colors.black54)),
              ],
            ),
            if ((pr.mergeBlockedReason ?? '').isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text('⚠️ ${pr.mergeBlockedReason!}',
                    style: TextStyle(
                        color: Colors.red[700], fontSize: 11.5)),
              ),
          ],
        ),
      ),
    );
  }
}

class _PRDetailSheet extends ConsumerStatefulWidget {
  const _PRDetailSheet({required this.repoId, required this.onChanged});
  final int repoId;
  final VoidCallback onChanged;
  @override
  ConsumerState<_PRDetailSheet> createState() => _PRDetailSheetState();
}

class _PRDetailSheetState extends ConsumerState<_PRDetailSheet> {
  final _cmtCtrl = TextEditingController();
  var _mode = DiffViewMode.split;

  @override
  void dispose() {
    _cmtCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pr = ref.watch(selectedPRProvider);
    if (pr == null) return const SizedBox.shrink();
    final comments = ref.watch(prCommentsProvider(
        (repoId: widget.repoId, number: pr.number)));
    final activities = ref.watch(prActivitiesProvider(
        (repoId: widget.repoId, number: pr.number)));
    final cmpAsync = ref.watch(compareProvider(widget.repoId));
    // 自动让 compareProvider 用 pr 的 base/head
    final curRefs = ref.watch(compareRefsProvider(widget.repoId));
    if (curRefs.base != pr.baseBranchName || curRefs.head != pr.headBranchName) {
      Future(() => ref
          .read(compareRefsProvider(widget.repoId).notifier)
          .state = CompareRefs(base: pr.baseBranchName, head: pr.headBranchName));
    }
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: .9,
      maxChildSize: .98,
      minChildSize: .5,
      builder: (ctx, scrollCtrl) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        pr.title,
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w700),
                      ),
                    ),
                    Text(' #${pr.number}',
                        style: TextStyle(
                            color: Theme.of(context).primaryColor,
                            fontWeight: FontWeight.w700)),
                  ],
                ),
                const SizedBox(height: 4),
                Text('🌿 ${pr.headBranchName} → ${pr.baseBranchName}',
                    style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: Theme.of(context).hintColor)),
                if ((pr.mergeBlockedReason ?? '').isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(top: 8),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                        color: Colors.red.withOpacity(.1),
                        borderRadius: BorderRadius.circular(6)),
                    child: Text('⚠️ ${pr.mergeBlockedReason!}',
                        style: TextStyle(
                            color: Colors.red[800], fontSize: 12)),
                  ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              controller: scrollCtrl,
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              children: [
                if ((pr.description ?? '').isNotEmpty)
                  Container(
                    padding: const EdgeInsets.all(10),
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                        border: Border.all(
                            color: Theme.of(context).dividerColor),
                        borderRadius: BorderRadius.circular(8)),
                    child: Text(pr.description!),
                  ),
                Row(
                  children: [
                    Text('文件变更',
                        style: Theme.of(context).textTheme.titleSmall),
                    const Spacer(),
                    SegmentedButton<DiffViewMode>(
                      segments: const [
                        ButtonSegment(value: DiffViewMode.split, label: Text('Split')),
                        ButtonSegment(value: DiffViewMode.unified, label: Text('Unified')),
                      ],
                      selected: {_mode},
                      onSelectionChanged: (s) => setState(() => _mode = s.first),
                    ),
                  ],
                ),
                cmpAsync.when(
                  data: (c) => c == null
                      ? const Text('无比较结果')
                      : Column(
                          children: [
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: Text(
                                  '📁 ${c.files.length} · +${c.additions} -${c.deletions}',
                                  style: const TextStyle(
                                      fontFamily: 'monospace')),
                            ),
                            ...c.files
                                .map((f) => DiffFileViewer(file: f, viewMode: _mode))
                          ],
                        ),
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Text('Diff 加载失败: $e'),
                ),
                const SizedBox(height: 12),
                const Divider(),
                const Text('💬 讨论',
                    style:
                        TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                const SizedBox(height: 6),
                comments.when(
                  data: (cs) => cs.isEmpty
                      ? const Text('暂无评论',
                          style: TextStyle(color: Colors.black54, fontSize: 12))
                      : Column(
                          children: cs
                              .where((c) => c.replyToId == null)
                              .map((c) => _commentTile(c, cs))
                              .toList(),
                        ),
                  loading: () => const CircularProgressIndicator(),
                  error: (e, _) => Text('评论加载失败: $e'),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _cmtCtrl,
                        decoration: const InputDecoration(
                            labelText: '发表评论 / 审批意见',
                            border: OutlineInputBorder()),
                        maxLines: 2,
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton.tonalIcon(
                      onPressed: _submitComment,
                      icon: const Icon(Icons.send, size: 16),
                      label: const Text('发表'),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                const Divider(),
                const Text('📋 活动日志',
                    style:
                        TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                activities.when(
                  data: (as) => Column(
                    children: as
                        .map((a) => Padding(
                              padding:
                                  const EdgeInsets.symmetric(vertical: 3),
                              child: Row(
                                children: [
                                  Text(
                                      a.createdAt.toString().substring(5, 16),
                                      style: const TextStyle(
                                          fontFamily: 'monospace',
                                          color: Colors.black45,
                                          fontSize: 11)),
                                  const SizedBox(width: 8),
                                  Text(a.actorName,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                          fontSize: 12)),
                                  const SizedBox(width: 6),
                                  Text(a.actionType,
                                      style: TextStyle(
                                          color: Theme.of(context).primaryColor,
                                          fontSize: 11.5)),
                                  if ((a.description ?? '').isNotEmpty)
                                    Expanded(
                                        child: Text(' · ${a.description!}',
                                            style: const TextStyle(
                                                color: Colors.black45,
                                                fontSize: 11.5))),
                                ],
                              ),
                            ))
                        .toList(),
                  ),
                  loading: () => const CircularProgressIndicator(),
                  error: (e, _) => Text('日志加载失败: $e'),
                ),
              ],
            ),
          ),
          SafeArea(
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border(
                    top: BorderSide(color: Theme.of(context).dividerColor)),
              ),
              child: Row(
                children: [
                  FilledButton.tonal(
                    onPressed: pr.status != PullRequestStatus.MERGED &&
                            pr.status != PullRequestStatus.CLOSED
                        ? () async {
                            final api = ref.read(gitApiProvider);
                            await api.closePR(widget.repoId, pr.number);
                            widget.onChanged();
                            if (mounted) Navigator.of(context).pop();
                          }
                        : pr.status == PullRequestStatus.CLOSED
                            ? () async {
                                final api = ref.read(gitApiProvider);
                                await api.reopenPR(widget.repoId, pr.number);
                                widget.onChanged();
                                if (mounted) Navigator.of(context).pop();
                              }
                            : null,
                    child: Text(pr.status == PullRequestStatus.CLOSED
                        ? '重新打开'
                        : '关闭'),
                  ),
                  const Spacer(),
                  FilledButton.icon(
                    onPressed: (pr.mergeBlockedReason ?? '').isNotEmpty ||
                            pr.status == PullRequestStatus.MERGED ||
                            pr.status == PullRequestStatus.CLOSED
                        ? null
                        : _merge,
                    icon: const Icon(Icons.merge_type),
                    label: const Text('合并 PR'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _commentTile(PRCommentEntity c, List<PRCommentEntity> all) {
    final replies = all.where((x) => x.replyToId == c.id).toList();
    final theme = Theme.of(context);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        border: Border.all(color: theme.dividerColor),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(radius: 12, child: Text(c.authorName.substring(0, 1))),
              const SizedBox(width: 6),
              Text(c.authorName,
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w700)),
              const SizedBox(width: 6),
              if (c.filePath != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                      color: Colors.black.withOpacity(.05),
                      borderRadius: BorderRadius.circular(4)),
                  child: Text('📍 ${c.filePath!}${c.lineNumber != null ? ':${c.lineNumber}' : ''}',
                      style: const TextStyle(
                          fontFamily: 'monospace', fontSize: 10.5)),
                ),
              const Spacer(),
              if (c.isResolved)
                const Text('✔ 已解决',
                    style: TextStyle(
                        fontSize: 11,
                        color: Colors.green,
                        fontWeight: FontWeight.w700)),
              Text(_ago(c.createdAt),
                  style: const TextStyle(fontSize: 10.5, color: Colors.black45)),
            ],
          ),
          const SizedBox(height: 6),
          Text(c.body,
              style: const TextStyle(fontSize: 13, height: 1.5)),
          if (replies.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8, left: 20),
              child: Column(
                  children: replies
                      .map((r) => Container(
                            padding: const EdgeInsets.all(8),
                            margin: const EdgeInsets.only(bottom: 4),
                            decoration: BoxDecoration(
                                color: Colors.black.withOpacity(.03),
                                borderRadius: BorderRadius.circular(6)),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                CircleAvatar(
                                    radius: 10,
                                    child: Text(r.authorName.substring(0, 1),
                                        style: const TextStyle(fontSize: 10))),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(r.authorName,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                              fontSize: 11.5)),
                                      Text(r.body,
                                          style:
                                              const TextStyle(fontSize: 12.5)),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ))
                      .toList()),
            ),
        ],
      ),
    );
  }

  Future<void> _submitComment() async {
    final pr = ref.read(selectedPRProvider);
    if (pr == null || _cmtCtrl.text.trim().isEmpty) return;
    try {
      await ref.read(gitApiProvider).addPRComment(
            widget.repoId,
            pr.number,
            body: _cmtCtrl.text.trim(),
          );
      _cmtCtrl.clear();
      ref.invalidate(prCommentsProvider(
          (repoId: widget.repoId, number: pr.number)));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('评论失败: $e')));
      }
    }
  }

  Future<void> _merge() async {
    final pr = ref.read(selectedPRProvider);
    if (pr == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('合并 PR #${pr.number}？'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(c).pop(false),
              child: const Text('取消')),
          FilledButton(
              onPressed: () => Navigator.of(c).pop(true),
              child: const Text('确认合并')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final r = await ref.read(gitApiProvider).mergePR(
            widget.repoId,
            pr.number,
            mergeStrategy: MergeStrategy.THREE_WAY,
          );
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(r.message)));
        widget.onChanged();
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('合并失败: $e')));
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
      return '${diff.inDays}d前';
    } catch (_) {
      return iso;
    }
  }
}

// =======================================================================
// Tab 7: Reflog
// =======================================================================
class _ReflogTab extends ConsumerWidget {
  const _ReflogTab({required this.repoId});
  final int repoId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logsAsync = ref.watch(reflogProvider(repoId));
    return logsAsync.when(
      data: (logs) => logs.isEmpty
          ? const Center(child: Text('暂无 Reflog'))
          : ListView.separated(
              padding: const EdgeInsets.all(8),
              itemCount: logs.length,
              separatorBuilder: (_, __) => const SizedBox(height: 6),
              itemBuilder: (ctx, i) {
                final e = logs[i];
                return ListTile(
                  tileColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                      side: BorderSide(
                          color: Theme.of(context).dividerColor)),
                  title: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: Theme.of(context)
                              .primaryColor
                              .withOpacity(.15),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(e.operation,
                            style: TextStyle(
                                color: Theme.of(context).primaryColor,
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700)),
                      ),
                      const SizedBox(width: 8),
                      Text('${e.branchName}@${e.indexInBranch}',
                          style: const TextStyle(
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.w700)),
                      const Spacer(),
                      Text(_ago(e.createdAt),
                          style: const TextStyle(
                              fontSize: 11, color: Colors.black45)),
                    ],
                  ),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                                '${e.oldCommitSha?.substring(0, 8) ?? '----'}  →  ${e.newCommitSha?.substring(0, 8) ?? '----'}',
                                style: const TextStyle(
                                    fontFamily: 'monospace', fontSize: 12)),
                          ),
                          Text('👤 ${e.actorName}',
                              style: const TextStyle(
                                  fontSize: 11, color: Colors.black54)),
                        ],
                      ),
                      if ((e.details ?? '').isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(e.details!,
                              style: const TextStyle(
                                  fontSize: 11,
                                  color: Colors.black54,
                                  fontStyle: FontStyle.italic)),
                        ),
                    ],
                  ),
                  trailing: FilledButton.tonalIcon(
                    onPressed: (e.newCommitSha ?? '').isEmpty
                        ? null
                        : () async {
                            final ok = await showDialog<bool>(
                              context: ctx,
                              builder: (c) => AlertDialog(
                                title: const Text('回滚到此状态'),
                                content: Text(
                                    '将 ${e.branchName} HARD reset 到 ${e.newCommitSha!.substring(0, 7)}？\n会丢弃这之后的提交，请谨慎操作。'),
                                actions: [
                                  TextButton(
                                      onPressed: () =>
                                          Navigator.of(c).pop(false),
                                      child: const Text('取消')),
                                  FilledButton(
                                      onPressed: () =>
                                          Navigator.of(c).pop(true),
                                      child: const Text('确认 HARD Reset')),
                                ],
                              ),
                            );
                            if (ok != true) return;
                            try {
                              final r =
                                  await ref.read(gitApiProvider).reset(
                                        repoId,
                                        branchName: e.branchName,
                                        targetSha: e.newCommitSha!,
                                        mode: ResetMode.HARD,
                                      );
                              if (ctx.mounted) {
                                ScaffoldMessenger.of(ctx).showSnackBar(
                                    SnackBar(content: Text(r.message)));
                                ref.invalidate(reflogProvider(repoId));
                                ref.invalidate(commitsProvider(repoId));
                              }
                            } catch (e2) {
                              if (ctx.mounted) {
                                ScaffoldMessenger.of(ctx).showSnackBar(
                                    SnackBar(
                                        content: Text('重置失败: $e2')));
                              }
                            }
                          },
                    icon: const Icon(Icons.restore_page, size: 16),
                    label: const Text('回滚到此'),
                  ),
                );
              },
            ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('加载失败: $e')),
    );
  }

  static String _ago(String iso) {
    try {
      final d = DateTime.parse(iso);
      final diff = DateTime.now().difference(d);
      if (diff.inSeconds < 60) return '${diff.inSeconds}s前';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m前';
      if (diff.inHours < 24) return '${diff.inHours}h前';
      return '${diff.inDays}d前';
    } catch (_) {
      return iso;
    }
  }
}

// =======================================================================
// Tab 8: Insights 贡献洞察
// =======================================================================
class _InsightsTab extends ConsumerWidget {
  const _InsightsTab({required this.repoId});
  final int repoId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final commitsAsync = ref.watch(commitsProvider(repoId));
    return commitsAsync.when(
      data: (commits) {
        final m = <String, (String, int, int, int, String)>{};
        for (final c in commits) {
          final cur = m[c.authorName] ?? (c.authorName, 0, 0, 0, c.committedAt);
          m[c.authorName] = (
            c.authorName,
            cur.$2 + 1,
            cur.$3 + c.additions,
            cur.$4 + c.deletions,
            cur.$5.compareTo(c.committedAt) > 0 ? cur.$5 : c.committedAt,
          );
        }
        final contribs = m.values.toList()
          ..sort((a, b) => b.$2 - a.$2);
        final total = commits.fold<int>(0, (acc, c) => acc + 1);
        final adds = commits.fold<int>(0, (acc, c) => acc + c.additions);
        final dels = commits.fold<int>(0, (acc, c) => acc + c.deletions);
        return ListView(
          padding: const EdgeInsets.all(12),
          children: [
            Row(
              children: [
                Expanded(child: _box('总提交', '$total', Icons.commit)),
                const SizedBox(width: 8),
                Expanded(child: _box('新增行', '+$adds', Icons.add, Colors.green)),
                const SizedBox(width: 8),
                Expanded(child: _box('删除行', '-$dels', Icons.remove, Colors.red)),
                const SizedBox(width: 8),
                Expanded(
                    child: _box('贡献者', '${contribs.length}', Icons.people,
                        Colors.purple)),
              ],
            ),
            const SizedBox(height: 16),
            const Text('贡献榜',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            const SizedBox(height: 8),
            if (contribs.isEmpty)
              const Center(child: Text('暂无数据'))
            else
              ...contribs.asMap().entries.map((e) {
                final i = e.key;
                final c = e.value;
                final maxCount = contribs.first.$2;
                final pct = maxCount == 0 ? 0.0 : c.$2 / maxCount;
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                          color: Theme.of(context).dividerColor)),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 16,
                            child: Text(c.$1.substring(0, 1)),
                          ),
                          const SizedBox(width: 8),
                          Text(c.$1,
                              style: const TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700)),
                          const Spacer(),
                          Text('📦 ${c.$2}',
                              style: const TextStyle(
                                  fontFamily: 'monospace',
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700)),
                          const SizedBox(width: 10),
                          Text('+${c.$3}',
                              style: TextStyle(
                                  color: Colors.green[700],
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700)),
                          const SizedBox(width: 6),
                          Text('-${c.$4}',
                              style: TextStyle(
                                  color: Colors.red[700],
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700)),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          minHeight: 6,
                          value: pct,
                          backgroundColor: Theme.of(context)
                              .primaryColor
                              .withOpacity(.1),
                          valueColor: AlwaysStoppedAnimation<Color>(
                              i == 0 ? Colors.amber : Theme.of(context).primaryColor),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('#${i + 1}',
                              style: TextStyle(
                                  color: i == 0
                                      ? Colors.amber
                                      : Colors.black45,
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700)),
                          Text('最近提交: ${c.$5}',
                              style: const TextStyle(
                                  fontFamily: 'monospace',
                                  fontSize: 10.5,
                                  color: Colors.black45)),
                        ],
                      ),
                    ],
                  ),
                );
              }),
          ],
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
    );
  }

  Widget _box(String label, String value, IconData icon, [Color? c]) =>
      Builder(builder: (ctx) {
        final color = c ?? Theme.of(ctx).primaryColor;
        return Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Theme.of(ctx).dividerColor),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(height: 4),
              Text(value,
                  style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w700,
                      fontSize: 16)),
              Text(label,
                  style: TextStyle(fontSize: 10.5, color: color.withOpacity(.8))),
            ],
          ),
        );
      });
}
