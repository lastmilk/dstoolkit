import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../widgets/adaptive_bottom_bar.dart';

/// 底部导航壳：对话 / 搜索 / 统计 / 仓库 / 我的
///
/// 底栏为自适应实现：设备支持时用液态玻璃（cupertino_liquid_glass），
/// 否则降级为 TDesign 原生底栏（见 AdaptiveBottomBar）。
class HomeShell extends StatelessWidget {
  const HomeShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const _tabs = [
    AdaptiveTab(
      icon: Icons.forum_outlined,
      activeIcon: Icons.forum_rounded,
      label: '对话',
    ),
    AdaptiveTab(
      icon: Icons.search_outlined,
      activeIcon: Icons.search_rounded,
      label: '搜索',
    ),
    AdaptiveTab(
      icon: Icons.insights_outlined,
      activeIcon: Icons.insights_rounded,
      label: '统计',
    ),
    AdaptiveTab(
      icon: Icons.folder_outlined,
      activeIcon: Icons.folder_rounded,
      label: '仓库',
    ),
    AdaptiveTab(
      icon: Icons.person_outline_rounded,
      activeIcon: Icons.person_rounded,
      label: '我的',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: AdaptiveBottomBar(
        tabs: _tabs,
        currentIndex: navigationShell.currentIndex,
        onTap: (i) => navigationShell.goBranch(
          i,
          initialLocation: i == navigationShell.currentIndex,
        ),
      ),
    );
  }
}
