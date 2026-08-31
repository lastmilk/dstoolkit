// =======================================================================
// git_api.dart —— 完整 Dart 版 Git API 客户端
// 对应后端 /api/git/* 所有路由，输入输出类型严格对齐 shared/git-core
// =======================================================================

import 'package:dio/dio.dart';

import '../models/git_types.dart';

class GitApi {
  GitApi(this._dio);

  final Dio _dio;

  static const _prefix = '/api/git';

  // ---- 工具：抽出 data 节点（后端统一包装 {ok, data, error}）
  Map<String, dynamic> _data(Response r) {
    final body = r.data;
    if (body is Map && body.containsKey('data')) {
      return (body['data'] as Map).cast<String, dynamic>();
    }
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  List<dynamic> _list(Response r) {
    final body = r.data;
    if (body is Map && body.containsKey('data')) {
      final d = body['data'];
      if (d is Map && d.containsKey('items')) return d['items'] as List<dynamic>;
      if (d is List) return d;
    }
    if (body is List) return body;
    // try nested keys
    return [];
  }

  // =========================================================
  // 对话绑定仓库
  // =========================================================
  Future<GitRepoEntity> createOrGetConvRepo(int convId) async {
    final r = await _dio.post('$_prefix/conversations/$convId/repo');
    return GitRepoEntity.fromJson(_data(r)['repo'] as Map<String, dynamic>);
  }

  // =========================================================
  // Repos
  // =========================================================
  Future<List<GitRepoEntity>> listRepos({
    int? ownerId,
    RepoVisibility? visibility,
    String? search,
    int? limit,
    int? offset,
  }) async {
    final q = <String, dynamic>{};
    if (ownerId != null) q['ownerId'] = ownerId;
    if (visibility != null) q['visibility'] = repoVisibilityToJson(visibility);
    if (search != null && search.isNotEmpty) q['search'] = search;
    if (limit != null) q['limit'] = limit;
    if (offset != null) q['offset'] = offset;
    final r = await _dio.get('$_prefix/repos', queryParameters: q);
    final d = _data(r);
    final items = (d['items'] as List<dynamic>? ?? const []);
    return items.map((e) => GitRepoEntity.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<GitRepoEntity> createRepo({
    required String name,
    String? description,
    RepoVisibility visibility = RepoVisibility.PRIVATE,
    GitRepoType type = GitRepoType.STANDARD,
    String? defaultBranchName = 'main',
    bool initialize = true,
  }) async {
    final r = await _dio.post('$_prefix/repos', data: {
      'name': name,
      if (description != null) 'description': description,
      'visibility': repoVisibilityToJson(visibility),
      'type': gitRepoTypeToJson(type),
      if (defaultBranchName != null) 'defaultBranchName': defaultBranchName,
      'initialize': initialize,
    });
    return GitRepoEntity.fromJson(_data(r)['repo'] as Map<String, dynamic>);
  }

  Future<GitRepoEntity> getRepo(int repoId) async {
    final r = await _dio.get('$_prefix/repos/$repoId');
    return GitRepoEntity.fromJson(_data(r)['repo'] as Map<String, dynamic>);
  }

  // =========================================================
  // Branches
  // =========================================================
  Future<List<GitBranchEntity>> listBranches(int repoId) async {
    final r = await _dio.get('$_prefix/repos/$repoId/branches');
    final list = (_data(r)['branches'] as List<dynamic>? ?? const []);
    return list.map((e) => GitBranchEntity.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<GitBranchEntity> createBranch(
    int repoId, {
    required String name,
    String? fromBranchName,
    String? fromCommitSha,
  }) async {
    final r = await _dio.post('$_prefix/repos/$repoId/branches', data: {
      'name': name,
      if (fromBranchName != null) 'fromBranchName': fromBranchName,
      if (fromCommitSha != null) 'fromCommitSha': fromCommitSha,
    });
    return GitBranchEntity.fromJson(_data(r)['branch'] as Map<String, dynamic>);
  }

  Future<void> deleteBranch(int repoId, String name, {bool force = false}) async {
    await _dio.delete('$_prefix/repos/$repoId/branches/${Uri.encodeComponent(name)}',
        queryParameters: {'force': force});
  }

  Future<GitBranchEntity> protectBranch(
    int repoId,
    String name, {
    required ProtectionLevel protectionLevel,
    List<int>? requiredReviewerIds,
    bool? forcePushAllowed,
  }) async {
    final r = await _dio.post(
      '$_prefix/repos/$repoId/branches/${Uri.encodeComponent(name)}/protect',
      data: {
        'protectionLevel': protectionLevelToJson(protectionLevel),
        if (requiredReviewerIds != null) 'requiredReviewerIds': requiredReviewerIds,
        if (forcePushAllowed != null) 'forcePushAllowed': forcePushAllowed,
      },
    );
    return GitBranchEntity.fromJson(_data(r)['branch'] as Map<String, dynamic>);
  }

  // =========================================================
  // Tags
  // =========================================================
  Future<List<GitTagEntity>> listTags(int repoId) async {
    final r = await _dio.get('$_prefix/repos/$repoId/tags');
    final list = (_data(r)['tags'] as List<dynamic>? ?? const []);
    return list.map((e) => GitTagEntity.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<GitTagEntity> createTag(
    int repoId, {
    required String name,
    required String targetCommitSha,
    String type = 'ANNOTATED',
    String? title,
    String? note,
  }) async {
    final r = await _dio.post('$_prefix/repos/$repoId/tags', data: {
      'name': name,
      'targetCommitSha': targetCommitSha,
      'type': type,
      if (title != null) 'title': title,
      if (note != null) 'note': note,
    });
    return GitTagEntity.fromJson(_data(r)['tag'] as Map<String, dynamic>);
  }

  Future<void> deleteTag(int repoId, String name) async {
    await _dio.delete('$_prefix/repos/$repoId/tags/${Uri.encodeComponent(name)}');
  }

  // =========================================================
  // Commits
  // =========================================================
  Future<List<GitCommitEntity>> listCommits(
    int repoId, {
    String? branchName,
    int? branchId,
    int? authorUserId,
    String? grep,
    String? changeType,
    int? limit,
    int? offset,
  }) async {
    final q = <String, dynamic>{};
    if (branchName != null) q['branchName'] = branchName;
    if (branchId != null) q['branchId'] = branchId;
    if (authorUserId != null) q['authorUserId'] = authorUserId;
    if (grep != null) q['grep'] = grep;
    if (changeType != null) q['changeType'] = changeType;
    if (limit != null) q['limit'] = limit;
    if (offset != null) q['offset'] = offset;
    final r = await _dio.get('$_prefix/repos/$repoId/commits', queryParameters: q);
    final list = (_data(r)['commits'] as List<dynamic>? ?? const []);
    return list
        .map((e) => GitCommitEntity.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<({GitCommitEntity commit, DiffResult diff, List<TreeFileItem> files})> getCommitDetail(
      int repoId, String sha) async {
    final r = await _dio.get('$_prefix/repos/$repoId/commits/$sha');
    final d = _data(r);
    return (
      commit: GitCommitEntity.fromJson(d['commit'] as Map<String, dynamic>),
      diff: DiffResult.fromJson(d['diff'] as Map<String, dynamic>),
      files: (d['files'] as List<dynamic>? ?? const [])
          .map((e) => TreeFileItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  // =========================================================
  // Tree / Compare
  // =========================================================
  Future<List<TreeFileItem>> listTree(int repoId, String ref, {String? path}) async {
    final q = <String, dynamic>{};
    if (path != null && path.isNotEmpty) q['path'] = path;
    final r = await _dio.get('$_prefix/repos/$repoId/tree/${Uri.encodeComponent(ref)}',
        queryParameters: q);
    final d = _data(r);
    final list = (d['files'] as List<dynamic>? ?? const []);
    return list.map((e) => TreeFileItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<({String path, String content, String mimeType, int sizeBytes, String sha})> readFile(
    int repoId,
    String ref,
    String path,
  ) async {
    final r = await _dio.get('$_prefix/repos/$repoId/tree/${Uri.encodeComponent(ref)}',
        queryParameters: {'path': path});
    final d = _data(r);
    return (
      path: d['path'] as String? ?? path,
      content: d['content'] as String? ?? '',
      mimeType: d['mimeType'] as String? ?? 'text/plain',
      sizeBytes: (d['sizeBytes'] as num?)?.toInt() ?? 0,
      sha: d['sha'] as String? ?? '',
    );
  }

  Future<CompareResponse> compare(int repoId, {required String base, required String head}) async {
    final r = await _dio.get('$_prefix/repos/$repoId/compare', queryParameters: {
      'base': base,
      'head': head,
    });
    return CompareResponse.fromJson(_data(r));
  }

  // =========================================================
  // Merge / Cherry-pick / Revert / Reset / Stash / Reflog
  // =========================================================
  Future<ServiceMergeResult> merge(
    int repoId, {
    required String baseBranchName,
    required String headBranchName,
    MergeStrategy strategy = MergeStrategy.THREE_WAY,
    String? message,
    int? authorUserId,
  }) async {
    final r = await _dio.post('$_prefix/repos/$repoId/merge', data: {
      'baseBranchName': baseBranchName,
      'headBranchName': headBranchName,
      'strategy': mergeStrategyToJson(strategy),
      if (message != null) 'message': message,
      if (authorUserId != null) 'authorUserId': authorUserId,
    });
    return ServiceMergeResult.fromJson(_data(r));
  }

  Future<({bool ok, String message, String? newCommitSha})> cherryPick(
    int repoId, {
    required String sha,
    required String ontoBranchName,
    int? authorUserId,
  }) async {
    final r = await _dio.post('$_prefix/repos/$repoId/cherry-pick', data: {
      'sha': sha,
      'ontoBranchName': ontoBranchName,
      if (authorUserId != null) 'authorUserId': authorUserId,
    });
    final d = _data(r);
    return (
      ok: d['ok'] as bool? ?? false,
      message: d['message'] as String? ?? '',
      newCommitSha: d['newCommitSha'] as String?,
    );
  }

  Future<({bool ok, String message, String? newCommitSha})> revert(
    int repoId, {
    required String sha,
    required String ontoBranchName,
    int? authorUserId,
  }) async {
    final r = await _dio.post('$_prefix/repos/$repoId/revert', data: {
      'sha': sha,
      'ontoBranchName': ontoBranchName,
      if (authorUserId != null) 'authorUserId': authorUserId,
    });
    final d = _data(r);
    return (
      ok: d['ok'] as bool? ?? false,
      message: d['message'] as String? ?? '',
      newCommitSha: d['newCommitSha'] as String?,
    );
  }

  Future<({bool ok, String message, String branchName, String newHeadSha})> reset(
    int repoId, {
    required String branchName,
    required String targetSha,
    ResetMode mode = ResetMode.MIXED,
  }) async {
    final r = await _dio.post('$_prefix/repos/$repoId/reset', data: {
      'branchName': branchName,
      'targetSha': targetSha,
      'mode': resetModeToJson(mode),
    });
    final d = _data(r);
    return (
      ok: d['ok'] as bool? ?? false,
      message: d['message'] as String? ?? '',
      branchName: d['branchName'] as String? ?? branchName,
      newHeadSha: d['newHeadSha'] as String? ?? '',
    );
  }

  Future<({bool ok, String message, int stashId})> stash(
    int repoId, {
    required String branchName,
    String? message,
    int? authorUserId,
  }) async {
    final r = await _dio.post('$_prefix/repos/$repoId/stash', data: {
      'branchName': branchName,
      if (message != null) 'message': message,
      if (authorUserId != null) 'authorUserId': authorUserId,
    });
    final d = _data(r);
    return (
      ok: d['ok'] as bool? ?? false,
      message: d['message'] as String? ?? '',
      stashId: (d['stashId'] as num?)?.toInt() ?? 0,
    );
  }

  Future<({bool ok, String message})> stashPop(int repoId, {int? index}) async {
    final r = await _dio.post('$_prefix/repos/$repoId/stash/pop',
        data: {if (index != null) 'index': index});
    final d = _data(r);
    return (
      ok: d['ok'] as bool? ?? false,
      message: d['message'] as String? ?? '',
    );
  }

  Future<List<ReflogEntryEntity>> reflog(
    int repoId, {
    String? branchName,
    int limit = 100,
  }) async {
    final q = <String, dynamic>{'limit': limit};
    if (branchName != null) q['branchName'] = branchName;
    final r = await _dio.get('$_prefix/repos/$repoId/reflog', queryParameters: q);
    final list = (_data(r)['entries'] as List<dynamic>? ?? const []);
    return list
        .map((e) => ReflogEntryEntity.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // =========================================================
  // Pull Requests
  // =========================================================
  Future<List<PullRequestEntity>> listPRs(
    int repoId, {
    PullRequestStatus? status,
    int? authorId,
    String? headBranchName,
    String? baseBranchName,
    String? search,
    int limit = 100,
    int offset = 0,
  }) async {
    final q = <String, dynamic>{
      'limit': limit,
      'offset': offset,
    };
    if (status != null) q['status'] = pullRequestStatusToJson(status);
    if (authorId != null) q['authorId'] = authorId;
    if (headBranchName != null) q['headBranchName'] = headBranchName;
    if (baseBranchName != null) q['baseBranchName'] = baseBranchName;
    if (search != null && search.isNotEmpty) q['search'] = search;
    final r = await _dio.get('$_prefix/repos/$repoId/prs', queryParameters: q);
    final list = (_data(r)['items'] as List<dynamic>? ?? const []);
    return list
        .map((e) => PullRequestEntity.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<PullRequestEntity> createPR(
    int repoId, {
    required String headBranchName,
    required String baseBranchName,
    required String title,
    String? description,
    int? assigneeId,
    List<int>? reviewerIds,
  }) async {
    final r = await _dio.post('$_prefix/repos/$repoId/prs', data: {
      'headBranchName': headBranchName,
      'baseBranchName': baseBranchName,
      'title': title,
      if (description != null) 'description': description,
      if (assigneeId != null) 'assigneeId': assigneeId,
      if (reviewerIds != null) 'reviewerIds': reviewerIds,
    });
    return PullRequestEntity.fromJson(_data(r)['pr'] as Map<String, dynamic>);
  }

  Future<PullRequestEntity> getPR(int repoId, int number) async {
    final r = await _dio.get('$_prefix/repos/$repoId/prs/$number');
    return PullRequestEntity.fromJson(_data(r)['pr'] as Map<String, dynamic>);
  }

  Future<PullRequestEntity> updatePR(
    int repoId,
    int number, {
    String? title,
    String? description,
    PullRequestStatus? status,
    int? assigneeId,
  }) async {
    final body = <String, dynamic>{};
    if (title != null) body['title'] = title;
    if (description != null) body['description'] = description;
    if (status != null) body['status'] = pullRequestStatusToJson(status);
    if (assigneeId != null) body['assigneeId'] = assigneeId;
    final r = await _dio.patch('$_prefix/repos/$repoId/prs/$number', data: body);
    return PullRequestEntity.fromJson(_data(r)['pr'] as Map<String, dynamic>);
  }

  Future<PullRequestEntity> closePR(int repoId, int number) async {
    final r = await _dio.post('$_prefix/repos/$repoId/prs/$number/close');
    return PullRequestEntity.fromJson(_data(r)['pr'] as Map<String, dynamic>);
  }

  Future<PullRequestEntity> reopenPR(int repoId, int number) async {
    final r = await _dio.post('$_prefix/repos/$repoId/prs/$number/reopen');
    return PullRequestEntity.fromJson(_data(r)['pr'] as Map<String, dynamic>);
  }

  Future<ServiceMergeResult> mergePR(
    int repoId,
    int number, {
    MergeStrategy? mergeStrategy,
    String? mergeMessage,
  }) async {
    final body = <String, dynamic>{};
    if (mergeStrategy != null) body['mergeStrategy'] = mergeStrategyToJson(mergeStrategy);
    if (mergeMessage != null) body['mergeMessage'] = mergeMessage;
    final r = await _dio.post('$_prefix/repos/$repoId/prs/$number/merge', data: body);
    return ServiceMergeResult.fromJson(_data(r));
  }

  // --- Reviews & Comments ---
  Future<PRReviewEntity> submitPRReview(
    int repoId,
    int number, {
    required String body,
    required PRReviewStatus status,
    String? commitSha,
  }) async {
    final r = await _dio.post('$_prefix/repos/$repoId/prs/$number/reviews', data: {
      'body': body,
      'status': prReviewStatusToJson(status),
      if (commitSha != null) 'commitSha': commitSha,
    });
    return PRReviewEntity.fromJson(_data(r)['review'] as Map<String, dynamic>);
  }

  Future<List<PRCommentEntity>> listPRComments(int repoId, int number,
      {String? filePath}) async {
    final q = <String, dynamic>{};
    if (filePath != null) q['filePath'] = filePath;
    final r = await _dio.get('$_prefix/repos/$repoId/prs/$number/comments',
        queryParameters: q);
    final list = (_data(r)['items'] as List<dynamic>? ?? const []);
    return list
        .map((e) => PRCommentEntity.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<PRCommentEntity> addPRComment(
    int repoId,
    int number, {
    required String body,
    int? replyToId,
    String? filePath,
    int? lineNumber,
    String? side,
  }) async {
    final r = await _dio.post('$_prefix/repos/$repoId/prs/$number/comments', data: {
      'body': body,
      if (replyToId != null) 'replyToId': replyToId,
      if (filePath != null) 'filePath': filePath,
      if (lineNumber != null) 'lineNumber': lineNumber,
      if (side != null) 'side': side,
    });
    return PRCommentEntity.fromJson(_data(r)['comment'] as Map<String, dynamic>);
  }

  Future<PRCommentEntity> resolvePRComment(
    int repoId,
    int number,
    int commentId,
  ) async {
    final r = await _dio
        .post('$_prefix/repos/$repoId/prs/$number/comments/$commentId/resolve');
    return PRCommentEntity.fromJson(_data(r)['comment'] as Map<String, dynamic>);
  }

  Future<List<PRActivityEntity>> listPRActivities(int repoId, int number) async {
    final r = await _dio.get('$_prefix/repos/$repoId/prs/$number/activities');
    final list = (_data(r)['items'] as List<dynamic>? ?? const []);
    return list
        .map((e) => PRActivityEntity.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
