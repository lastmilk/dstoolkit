import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/auth_controller.dart';
import '../../features/auth/login_page.dart';
import '../../features/conversation/detail/conversation_detail_page.dart';
import '../../features/conversation/list/conversation_list_page.dart';
import '../../features/git/pages/git_repo_page.dart';
import '../../features/git/pages/git_repos_list_page.dart';
import '../../features/home/home_shell.dart';
import '../../features/profile/profile_page.dart';
import '../../features/search/search_page.dart';
import '../../features/stats/stats_page.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authControllerProvider);

  return GoRouter(
    initialLocation: '/conversations',
    redirect: (context, state) {
      final loggingIn = state.matchedLocation == '/login';
      switch (auth.status) {
        case AuthStatus.unknown:
          return null; // 等待 bootstrap
        case AuthStatus.loggedOut:
          return loggingIn ? null : '/login';
        case AuthStatus.loggedIn:
        case AuthStatus.guest: // 游客可浏览主界面（功能页内部做门禁）
          return loggingIn ? '/conversations' : null;
      }
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginPage(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            HomeShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/conversations',
              builder: (context, state) => const ConversationListPage(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/search',
              builder: (context, state) => const SearchPage(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/stats',
              builder: (context, state) => const StatsPage(),
            ),
          ]),
          // Git 仓库中心作为独立的底部导航 Tab
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/git/repos',
              builder: (context, state) => const GitReposListPage(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/profile',
              builder: (context, state) => const ProfilePage(),
            ),
          ]),
        ],
      ),
      GoRoute(
        path: '/conversation/:configId/:convId',
        builder: (context, state) => ConversationDetailPage(
          configId: int.parse(state.pathParameters['configId']!),
          convId: state.pathParameters['convId']!,
        ),
      ),
      // Git 仓库详情页
      GoRoute(
        path: '/git/repos/:repoId',
        builder: (context, state) {
          final repoId = int.parse(state.pathParameters['repoId']!);
          final tab = (state.uri.queryParameters['tab'] ?? 'code');
          final initialTab = switch (tab) {
            'code' => 0,
            'commits' => 1,
            'branches' => 2,
            'tags' => 3,
            'compare' => 4,
            'pr' => 5,
            'reflog' => 6,
            'insights' => 7,
            _ => 0,
          };
          return GitRepoPage(repoId: repoId, initialTab: initialTab);
        },
      ),
    ],
  );
});
