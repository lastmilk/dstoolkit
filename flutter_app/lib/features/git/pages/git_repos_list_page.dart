// =======================================================================
// git_repos_list_page.dart
// Flutter 版：仓库中心列表页（对应前端 GitReposList.vue）
// 功能：Tab(我的/可见/公开)、搜索、新建仓库、快速绑定对话
// =======================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../providers/git_providers.dart';
import '../../data/models/git_types.dart';
import 'git_repo_page.dart';

class GitReposListPage extends ConsumerStatefulWidget {
  const GitReposListPage({super.key});

  @override
  ConsumerState<GitReposListPage> createState() => _GitReposListPageState();
}

class _GitReposListPageState extends ConsumerState<GitReposListPage> {
  final _searchCtrl = TextEditingController();
  final _convIdCtrl = TextEditingController();
  final _searchFocus = FocusNode();

  @override
  void dispose() {
    _searchCtrl.dispose();
    _convIdCtrl.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filter = ref.watch(reposFilterProvider);
    final reposAsync = ref.watch(reposListProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('🌿 Git 仓库中心'),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline),
            tooltip: '新建仓库',
            onPressed: () => _openNewRepoSheet(context),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(reposListProvider.future),
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            // Hero 统计卡
            _buildHeroCard(theme, reposAsync.valueOrNull ?? const []),
            const SizedBox(height: 12),

            // Tab 切换
            _buildTabs(filter, theme),
            const SizedBox(height: 10),

            // 搜索 + 新建
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchCtrl,
                    focusNode: _searchFocus,
                    onSubmitted: (_) => _applySearch(),
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      hintText: '搜索仓库名/描述/对话ID',
                      isDense: true,
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton.icon(
                  onPressed: () => _openNewRepoSheet(context),
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('新建'),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // 对话快速绑定
            _buildConvLinkCard(theme),
            const SizedBox(height: 14),

            // 仓库列表
            reposAsync.when(
              data: (list) => list.isEmpty
                  ? const _EmptyHint()
                  : Column(
                      children: list
                          .map((r) => _RepoCard(
                                repo: r,
                                onTap: () => context.push('/git/repos/${r.id}'),
                              ))
                          .toList(),
                    ),
              loading: () => const Padding(
                padding: EdgeInsets.all(40),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Padding(
                padding: const EdgeInsets.all(20),
                child: Text('加载失败: $e',
                    style: const TextStyle(color: Colors.red)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _applySearch() {
    final cur = ref.read(reposFilterProvider);
    ref.read(reposFilterProvider.notifier).state =
        cur.copyWith(search: _searchCtrl.text.trim());
  }

  Widget _buildHeroCard(ThemeData theme, List<GitRepoEntity> repos) {
    final totalCommits =
        repos.fold<int>(0, (acc, r) => acc + (r.commitCount));
    final totalBranches =
        repos.fold<int>(0, (acc, r) => acc + (r.branchCount));
    final totalPRs = repos.fold<int>(
        0, (acc, r) => acc + (r.pullRequestCount ?? 0));
    final stats = [
      ('仓库', repos.length, Icons.account_tree_outlined),
      ('提交', totalCommits, Icons.commit_outlined),
      ('分支', totalBranches, Icons.fork_right_outlined),
      ('合并请求', totalPRs, Icons.merge_type_outlined),
    ];
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          colors: [theme.primaryColor.withOpacity(.1), Colors.white],
        ),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.hub, size: 28),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text('GitHub 风格对话版本控制',
                        style: TextStyle(
                            fontSize: 17, fontWeight: FontWeight.w700)),
                    SizedBox(height: 4),
                    Text(
                      '每个对话 = 一个仓库；每条消息 = 一次 commit。支持分支、回滚、Diff、PR、Reflog。',
                      style: TextStyle(color: Colors.black54, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 4,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 1.2,
            children: stats
                .map((s) => Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: theme.dividerColor),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Column(
                        children: [
                          Icon(s.$3, size: 16, color: theme.primaryColor),
                          const SizedBox(height: 2),
                          Text('${s.$2}',
                              style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: theme.primaryColor)),
                          Text(s.$1,
                              style: const TextStyle(
                                  fontSize: 10.5, color: Colors.black54)),
                        ],
                      ),
                    ))
                .toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildTabs(ReposListFilter filter, ThemeData theme) {
    final tabs = [
      (ReposListTab.owner, '我的', '我创建的'),
      (ReposListTab.visible, '我可见', '协作/加入'),
      (ReposListTab.pub, '公开', '全部公开'),
    ];
    return Row(
      children: tabs
          .map((t) {
            final selected = filter.tab == t.$1;
            return Padding(
              padding: const EdgeInsets.only(right: 6),
              child: ChoiceChip(
                label: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t.$2,
                        style: TextStyle(
                            fontSize: 12.5,
                            fontWeight:
                                selected ? FontWeight.w700 : FontWeight.w500)),
                    Text(t.$3,
                        style: TextStyle(
                            fontSize: 9.5,
                            color: selected ? Colors.white70 : Colors.black45)),
                  ],
                ),
                selected: selected,
                onSelected: (_) {
                  ref.read(reposFilterProvider.notifier).state =
                      filter.copyWith(tab: t.$1);
                },
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              ),
            );
          })
          .toList(),
    );
  }

  Widget _buildConvLinkCard(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Row(
        children: [
          const Icon(Icons.forum, size: 24, color: Colors.green),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text('对话绑定仓库',
                    style:
                        TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                SizedBox(height: 2),
                Text('输入对话ID，直接打开或初始化仓库',
                    style: TextStyle(color: Colors.black54, fontSize: 11.5)),
              ],
            ),
          ),
          SizedBox(
            width: 120,
            child: TextField(
              controller: _convIdCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                isDense: true,
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                labelText: 'Conv ID',
                border: OutlineInputBorder(),
                hintStyle: TextStyle(fontSize: 12),
              ),
            ),
          ),
          const SizedBox(width: 8),
          FilledButton(
            onPressed: _goConvRepo,
            style: FilledButton.styleFrom(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
            child: const Text('🚀 打开'),
          ),
        ],
      ),
    );
  }

  void _goConvRepo() async {
    final id = int.tryParse(_convIdCtrl.text.trim());
    if (id == null) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('请输入有效的对话 ID（数字）')));
      return;
    }
    final api = ref.read(gitApiProvider);
    try {
      final repo = await api.createOrGetConvRepo(id);
      if (mounted) {
        context.push('/git/repos/${repo.id}');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('绑定失败: $e')));
      }
    }
  }

  void _openNewRepoSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
          left: 16,
          right: 16,
          top: 8,
        ),
        child: _NewRepoForm(onCreated: (repo) {
          Navigator.of(ctx).pop();
          ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('仓库 ${repo.name} 已创建')));
          ref.invalidate(reposListProvider);
          context.push('/git/repos/${repo.id}');
        }),
      ),
    );
  }
}

// =======================================================================
// 子组件：新建仓库表单
// =======================================================================
class _NewRepoForm extends ConsumerStatefulWidget {
  const _NewRepoForm({required this.onCreated});
  final ValueChanged<GitRepoEntity> onCreated;
  @override
  ConsumerState<_NewRepoForm> createState() => _NewRepoFormState();
}

class _NewRepoFormState extends ConsumerState<_NewRepoForm> {
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _branchCtrl = TextEditingController(text: 'main');
  RepoVisibility _vis = RepoVisibility.PRIVATE;
  bool _init = true;
  bool _saving = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _branchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('新建 Git 仓库',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        TextField(
          controller: _nameCtrl,
          decoration: const InputDecoration(
            labelText: '仓库名 *',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _descCtrl,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: '描述',
            alignLabelWithHint: true,
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<RepoVisibility>(
          value: _vis,
          decoration: const InputDecoration(
            labelText: '可见性',
            border: OutlineInputBorder(),
          ),
          items: const [
            DropdownMenuItem(value: RepoVisibility.PRIVATE, child: Text('🔒 私有')),
            DropdownMenuItem(value: RepoVisibility.UNLISTED, child: Text('🔗 未列出')),
            DropdownMenuItem(value: RepoVisibility.PUBLIC, child: Text('🌍 公开')),
          ],
          onChanged: (v) => setState(() => _vis = v ?? _vis),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _branchCtrl,
          decoration: const InputDecoration(
            labelText: '默认分支名',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Checkbox(
                value: _init,
                onChanged: (v) => setState(() => _init = v ?? true)),
            const Expanded(child: Text('初始化空提交（推荐）')),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: _saving ? null : _submit,
            child: _saving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('创建仓库'),
          ),
        ),
      ],
    );
  }

  Future<void> _submit() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _saving = true);
    try {
      final r = await ref.read(gitApiProvider).createRepo(
            name: _nameCtrl.text.trim(),
            description:
                _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
            visibility: _vis,
            type: GitRepoType.STANDARD,
            defaultBranchName: _branchCtrl.text.trim().isEmpty
                ? null
                : _branchCtrl.text.trim(),
            initialize: _init,
          );
      if (!mounted) return;
      widget.onCreated(r);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('创建失败: $e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

// =======================================================================
// 子组件：仓库卡片
// =======================================================================
class _RepoCard extends StatelessWidget {
  const _RepoCard({required this.repo, required this.onTap});
  final GitRepoEntity repo;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final visIcon = switch (repo.visibility) {
      RepoVisibility.PRIVATE => '🔒',
      RepoVisibility.UNLISTED => '🔗',
      RepoVisibility.PUBLIC => '🌍',
    };
    final typeChip = repo.type == GitRepoType.CONVERSATION
        ? ('💬 对话仓库', Colors.green.withOpacity(.12), Colors.green[700]!)
        : ('🗂️ 标准仓库', Colors.blue.withOpacity(.12), Colors.blue[700]!);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            border: Border.all(color: theme.dividerColor),
            borderRadius: BorderRadius.circular(12),
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
                        color: typeChip.$2,
                        borderRadius: BorderRadius.circular(999)),
                    child: Text(typeChip.$1,
                        style: TextStyle(
                            fontSize: 10.5,
                            color: typeChip.$3,
                            fontWeight: FontWeight.w600)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(repo.name,
                        style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w700),
                        overflow: TextOverflow.ellipsis),
                  ),
                  Text(visIcon),
                ],
              ),
              const SizedBox(height: 6),
              if (repo.description?.isNotEmpty ?? false)
                Text(repo.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: Colors.black54, fontSize: 12.5))
              else if (repo.conversationId != null)
                Text.rich(
                  TextSpan(
                    children: [
                      const TextSpan(
                          text: '对话 #',
                          style: TextStyle(color: Colors.black54)),
                      TextSpan(
                          text: '${repo.conversationId}',
                          style: TextStyle(
                              color: theme.primaryColor,
                              fontWeight: FontWeight.w600)),
                      const TextSpan(
                          text: '  — 每条消息自动生成一个 commit',
                          style: TextStyle(color: Colors.black54)),
                    ],
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 12,
                runSpacing: 4,
                children: [
                  _chip(Icons.fork_right, '${repo.branchCount} 分支'),
                  _chip(Icons.commit, '${repo.commitCount} 提交'),
                  _chip(Icons.merge_type, '${repo.pullRequestCount ?? 0} PR'),
                  _chip(Icons.star_outline, '${repo.starCount ?? 0}'),
                  const Spacer(),
                  Text(
                    _ago(repo.updatedAt),
                    style: const TextStyle(
                        color: Colors.black45, fontSize: 11.5),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _chip(IconData i, String t) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(i, size: 13),
          const SizedBox(width: 3),
          Text(t, style: const TextStyle(fontSize: 11.5, color: Colors.black54)),
        ],
      );

  static String _ago(String iso) {
    try {
      final d = DateTime.parse(iso);
      final diff = DateTime.now().difference(d);
      if (diff.inSeconds < 60) return '${diff.inSeconds}秒前';
      if (diff.inMinutes < 60) return '${diff.inMinutes}分钟前';
      if (diff.inHours < 24) return '${diff.inHours}小时前';
      if (diff.inDays < 30) return '${diff.inDays}天前';
      return DateFormat('yyyy-MM-dd').format(d);
    } catch (_) {
      return iso;
    }
  }
}

class _EmptyHint extends StatelessWidget {
  const _EmptyHint();
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Column(
          children: [
            const Icon(Icons.bubble_chart_outlined, size: 40),
            const SizedBox(height: 10),
            const Text('还没有仓库',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            const Text('输入上方对话ID 或 创建新仓库 即可开始',
                style: TextStyle(color: Colors.black54, fontSize: 12.5)),
          ],
        ),
      ),
    );
  }
}
