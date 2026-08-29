import 'package:dio/dio.dart';

import '../models/models.dart';

/// /api/v1/* RESTful API（Bearer dstk_ 鉴权由 Dio 拦截器注入）
class V1Api {
  V1Api(this.dio);

  final Dio dio;

  Future<User> me() async {
    final res = await dio.get('/v1/me');
    return User.fromJson((res.data as Map<String, dynamic>)['user'] as Map<String, dynamic>);
  }

  Future<List<DeepseekConfig>> configs() async {
    final res = await dio.get('/v1/configs');
    final list = (res.data as Map<String, dynamic>)['configs'] as List<dynamic>;
    return list
        .map((e) => DeepseekConfig.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Paged<ConversationLite>> conversations({
    required int configId,
    int page = 1,
    int pageSize = 20,
  }) async {
    final res = await dio.get(
      '/v1/configs/$configId/conversations',
      queryParameters: {'page': page, 'pageSize': pageSize},
    );
    return Paged.fromJson(
      res.data as Map<String, dynamic>,
      ConversationLite.fromJson,
    );
  }

  Future<ConversationDetail> conversationDetail({
    required int configId,
    required String convId,
  }) async {
    final res = await dio.get('/v1/configs/$configId/conversations/$convId');
    return ConversationDetail.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<SearchResult>> search({
    required String keyword,
    int? configId,
    int limit = 50,
  }) async {
    final res = await dio.get(
      '/v1/search',
      queryParameters: {
        'q': keyword,
        if (configId != null) 'configId': configId,
        'limit': limit,
      },
    );
    final list = (res.data as Map<String, dynamic>)['results'] as List<dynamic>;
    return list
        .map((e) => SearchResult.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<StatsSummary> stats() async {
    final res = await dio.get('/v1/stats');
    return StatsSummary.fromJson(res.data as Map<String, dynamic>);
  }

  // ═══════════ 聊天仓库管理（/api/v1/repos，与 /api/v1/configs 兼容） ═══════════

  /// 列出当前用户的所有仓库
  Future<List<ChatRepo>> repos() async {
    final res = await dio.get('/v1/repos');
    final data = res.data as Map<String, dynamic>;
    final list = (data['repos'] ?? data['configs']) as List<dynamic>;
    return list
        .map((e) => ChatRepo.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// 获取仓库提交历史（首次访问自动回填初始提交）
  Future<({List<RepoCommit> commits, int snapshotBytes})> repoHistory({
    required int repoId,
  }) async {
    final res = await dio.get('/v1/repos/$repoId/history');
    final data = res.data as Map<String, dynamic>;
    final list = (data['commits'] ?? []) as List<dynamic>;
    final commits = list
        .map((e) => RepoCommit.fromJson(e as Map<String, dynamic>))
        .toList();
    final snapshotBytes = (data['snapshotBytes'] as num?)?.toInt() ?? 0;
    return (commits: commits, snapshotBytes: snapshotBytes);
  }

  /// 回滚到指定提交（追加回滚 commit，不改写历史）
  Future<void> rollbackRepo({
    required int repoId,
    required String sha,
  }) async {
    await dio.post('/v1/repos/$repoId/rollback', data: {'sha': sha});
  }

  /// 下载指定提交的 conversations.json（返回响应流，调用方负责保存）
  Future<Response> downloadSnapshot({
    required int repoId,
    required String sha,
  }) async {
    return dio.get(
      '/v1/repos/$repoId/commits/$sha/download',
      options: Options(responseType: ResponseType.bytes),
    );
  }

  /// 创建仓库（可选附带 zip 数据包）
  Future<ChatRepo> createRepo({
    required String name,
    String? description,
    String? filePath,
  }) async {
    final formData = FormData.fromMap({
      'name': name,
      if (description != null && description.isNotEmpty) 'description': description,
      if (filePath != null)
        'file': await MultipartFile.fromFile(filePath, filename: 'upload.zip'),
    });
    final res = await dio.post('/v1/repos', data: formData);
    final data = res.data as Map<String, dynamic>;
    return ChatRepo.fromJson(
        (data['repo'] ?? data['config']) as Map<String, dynamic>);
  }

  /// 上传 zip 到已有仓库（增量导入 → 新 commit）
  Future<({ChatRepo repo, int added, int updated})> uploadToRepo({
    required int repoId,
    required String filePath,
  }) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath, filename: 'upload.zip'),
    });
    final res = await dio.put('/v1/repos/$repoId/upload', data: formData);
    final data = res.data as Map<String, dynamic>;
    final repo = ChatRepo.fromJson(
        (data['repo'] ?? data['config']) as Map<String, dynamic>);
    final added = (data['added'] as num?)?.toInt() ?? 0;
    final updated = (data['updated'] as num?)?.toInt() ?? 0;
    return (repo: repo, added: added, updated: updated);
  }

  /// 更新仓库元信息（重命名 / 改描述）
  Future<ChatRepo> updateRepo({
    required int repoId,
    String? name,
    String? description,
  }) async {
    final res = await dio.put('/v1/repos/$repoId', data: {
      if (name != null) 'name': name,
      if (description != null) 'description': description,
    });
    final data = res.data as Map<String, dynamic>;
    return ChatRepo.fromJson(data['repo'] as Map<String, dynamic>);
  }

  /// 删除仓库（DB 级联 + 磁盘 Git 仓库）
  Future<void> deleteRepo({required int repoId}) async {
    await dio.delete('/v1/repos/$repoId');
  }
}
