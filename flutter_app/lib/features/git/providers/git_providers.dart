// =======================================================================
// git_providers.dart
// Riverpod 2.x Providers — 完整覆盖 Flutter Git 模块状态
// =======================================================================

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/api/git_api.dart';
import '../../data/api/dio_client.dart';
import '../../data/api/oauth_api.dart';
import '../../data/models/git_types.dart';
import '../../data/local/token_store.dart';
import '../auth/auth_controller.dart';

// ================= Git API Client =================
final gitApiProvider = Provider<GitApi>((ref) {
  final tokenStore = ref.watch(tokenStoreProvider);
  final dio = buildDio(
    tokenProvider: tokenStore,
    oauthApi: OAuthApi(buildBareDio()),
  );
  return GitApi(dio);
});

// ================= 对话绑定仓库 =================
final convBindingRepoProvider =
    FutureProvider.family<GitRepoEntity?, int>((ref, convId) async {
  final api = ref.watch(gitApiProvider);
  try {
    return await api.createOrGetConvRepo(convId);
  } on DioException {
    return null;
  }
});

// ================= 仓库列表 =================
class ReposListFilter {
  const ReposListFilter({
    this.tab = ReposListTab.owner,
    this.search = '',
  });
  final ReposListTab tab;
  final String search;
  ReposListFilter copyWith({ReposListTab? tab, String? search}) =>
      ReposListFilter(tab: tab ?? this.tab, search: search ?? this.search);
}

enum ReposListTab { owner, visible, pub }

final reposFilterProvider =
    StateProvider<ReposListFilter>((_) => const ReposListFilter());

final reposListProvider = FutureProvider<List<GitRepoEntity>>((ref) async {
  final api = ref.watch(gitApiProvider);
  final f = ref.watch(reposFilterProvider);
  RepoVisibility? vis;
  if (f.tab == ReposListTab.owner) vis = RepoVisibility.PRIVATE;
  if (f.tab == ReposListTab.pub) vis = RepoVisibility.PUBLIC;
  return api.listRepos(
    visibility: vis,
    search: f.search.isEmpty ? null : f.search,
    limit: 50,
  );
});

// ================= 仓库详情 =================
final repoProvider =
    FutureProvider.family<GitRepoEntity, int>((ref, id) async {
  return ref.watch(gitApiProvider).getRepo(id);
});

final branchesProvider =
    FutureProvider.family<List<GitBranchEntity>, int>((ref, repoId) async {
  return ref.watch(gitApiProvider).listBranches(repoId);
});

final tagsProvider =
    FutureProvider.family<List<GitTagEntity>, int>((ref, repoId) async {
  return ref.watch(gitApiProvider).listTags(repoId);
});

// ================= 当前ref（分支/标签） =================
final currentRefProvider =
    StateProvider.family<String, int>((ref, repoId) {
  final br = ref.watch(branchesProvider(repoId)).valueOrNull;
  final def = br?.where((b) => b.isDefault).firstOrNull ?? br?.firstOrNull;
  return def?.name ?? 'main';
});

// ================= Commits =================
class CommitsQuery {
  const CommitsQuery({this.limit = 50});
  final int limit;
}

final commitsQueryProvider =
    StateProvider.family<CommitsQuery, int>((_, __) => const CommitsQuery());

final commitsProvider =
    FutureProvider.family<List<GitCommitEntity>, int>((ref, repoId) async {
  final api = ref.watch(gitApiProvider);
  final refName = ref.watch(currentRefProvider(repoId));
  final q = ref.watch(commitsQueryProvider(repoId));
  return api.listCommits(
    repoId,
    branchName: refName,
    limit: q.limit,
  );
});

// ================= Commit Detail =================
final commitDetailProvider = FutureProvider.family<
    ({GitCommitEntity commit, DiffResult diff, List<TreeFileItem> files}),
    ({int repoId, String sha})>((ref, key) {
  return ref.watch(gitApiProvider).getCommitDetail(key.repoId, key.sha);
});

// ================= Tree =================
final treeProvider = FutureProvider.family<List<TreeFileItem>,
    ({int repoId, String ref, String? path})>((ref, key) {
  return ref.watch(gitApiProvider).listTree(key.repoId, key.ref, path: key.path);
});

final filePathProvider = StateProvider<String?>((_) => null);

// ================= Compare =================
class CompareRefs {
  const CompareRefs({this.base = '', this.head = ''});
  final String base;
  final String head;
  CompareRefs copyWith({String? base, String? head}) =>
      CompareRefs(base: base ?? this.base, head: head ?? this.head);
  bool get valid => base.isNotEmpty && head.isNotEmpty && base != head;
}

final compareRefsProvider =
    StateProvider.family<CompareRefs, int>((_, __) => const CompareRefs());

final compareProvider = FutureProvider.family<CompareResponse?, int>((ref, repoId) async {
  final refs = ref.watch(compareRefsProvider(repoId));
  if (!refs.valid) return null;
  return ref.watch(gitApiProvider).compare(repoId, base: refs.base, head: refs.head);
});

// ================= Reflog =================
final reflogProvider = FutureProvider.family<List<ReflogEntryEntity>, int>((ref, repoId) async {
  return ref.watch(gitApiProvider).reflog(repoId, limit: 200);
});

// ================= PRs =================
final prStatusFilterProvider =
    StateProvider<PullRequestStatus?>((_) => null);

final prListProvider =
    FutureProvider.family<List<PullRequestEntity>, int>((ref, repoId) async {
  final api = ref.watch(gitApiProvider);
  final status = ref.watch(prStatusFilterProvider);
  return api.listPRs(repoId, status: status, limit: 100);
});

final selectedPRProvider = StateProvider<PullRequestEntity?>((_) => null);
final prCommentsProvider = FutureProvider.family<List<PRCommentEntity>,
    ({int repoId, int number})>((ref, key) {
  return ref.watch(gitApiProvider).listPRComments(key.repoId, key.number);
});
final prActivitiesProvider = FutureProvider.family<List<PRActivityEntity>,
    ({int repoId, int number})>((ref, key) {
  return ref.watch(gitApiProvider).listPRActivities(key.repoId, key.number);
});
