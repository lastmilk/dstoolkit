import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/api/v1_api.dart';
import '../../data/models/models.dart';
import '../auth/auth_controller.dart';

class RepoListState {
  const RepoListState({
    this.repos = const [],
    this.loading = false,
    this.error,
  });

  final List<ChatRepo> repos;
  final bool loading;
  final String? error;

  RepoListState copyWith({
    List<ChatRepo>? repos,
    bool? loading,
    String? error,
    bool clearError = false,
  }) =>
      RepoListState(
        repos: repos ?? this.repos,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
      );
}

class RepoListController extends StateNotifier<RepoListState> {
  RepoListController(this._api) : super(const RepoListState(loading: true)) {
    _init();
  }

  final V1Api _api;

  Future<void> _init() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final repos = await _api.repos();
      state = RepoListState(repos: repos);
    } catch (e) {
      state = RepoListState(error: '加载失败，下拉重试');
    }
  }

  Future<void> refresh() async => _init();

  Future<void> deleteRepo(int repoId) async {
    try {
      await _api.deleteRepo(repoId: repoId);
      state = state.copyWith(
        repos: state.repos.where((r) => r.id != repoId).toList(),
      );
    } catch (e) {
      state = state.copyWith(error: '删除失败');
    }
  }
}

final repoListProvider = StateNotifierProvider.autoDispose<
    RepoListController, RepoListState>(
  (ref) => RepoListController(ref.watch(v1ApiProvider)),
);

// ═══════════ 历史页独立 Provider ═══════════

class RepoHistoryState {
  const RepoHistoryState({
    this.commits = const [],
    this.snapshotBytes = 0,
    this.loading = false,
    this.error,
  });

  final List<RepoCommit> commits;
  final int snapshotBytes;
  final bool loading;
  final String? error;

  RepoHistoryState copyWith({
    List<RepoCommit>? commits,
    int? snapshotBytes,
    bool? loading,
    String? error,
    bool clearError = false,
  }) =>
      RepoHistoryState(
        commits: commits ?? this.commits,
        snapshotBytes: snapshotBytes ?? this.snapshotBytes,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
      );
}

class RepoHistoryController extends StateNotifier<RepoHistoryState> {
  RepoHistoryController(this._api, this.repoId)
      : super(const RepoHistoryState(loading: true)) {
    _load();
  }

  final V1Api _api;
  final int repoId;

  Future<void> _load() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final result = await _api.repoHistory(repoId: repoId);
      state = RepoHistoryState(
        commits: result.commits,
        snapshotBytes: result.snapshotBytes,
      );
    } catch (e) {
      state = state.copyWith(loading: false, error: '加载历史失败');
    }
  }

  Future<void> refresh() async => _load();

  Future<bool> rollback(String sha) async {
    try {
      await _api.rollbackRepo(repoId: repoId, sha: sha);
      await _load();
      return true;
    } catch (e) {
      state = state.copyWith(error: '回滚失败');
      return false;
    }
  }
}

final repoHistoryProvider = StateNotifierProvider.autoDispose
    .family<RepoHistoryController, RepoHistoryState, int>(
  (ref, repoId) => RepoHistoryController(ref.watch(v1ApiProvider), repoId),
);
