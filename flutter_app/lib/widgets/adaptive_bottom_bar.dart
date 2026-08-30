import 'package:cupertino_liquid_glass/cupertino_liquid_glass.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';

import '../core/services/glass_capability.dart';
import '../core/theme/td_theme.dart';

/// 底栏 tab 统一模型（两种底栏共用）
class AdaptiveTab {
  const AdaptiveTab({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
}

/// 自适应底部导航栏：
///
/// - 设备支持（Android 12+ / iOS 16+ / 桌面）→ cupertino_liquid_glass 液态玻璃底栏
/// - 不支持或检测失败 → TDesign `TDBottomTabBar` 原生底栏降级
class AdaptiveBottomBar extends ConsumerWidget {
  const AdaptiveBottomBar({
    super.key,
    required this.tabs,
    required this.currentIndex,
    required this.onTap,
  });

  final List<AdaptiveTab> tabs;
  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final capability = ref.watch(glassCapabilityProvider);
    final useGlass = capability.valueOrNull ?? false;
    if (useGlass) {
      return _LiquidGlassBar(
        tabs: tabs,
        currentIndex: currentIndex,
        onTap: onTap,
      );
    }
    return _TdFallbackBar(
      tabs: tabs,
      currentIndex: currentIndex,
      onTap: onTap,
    );
  }
}

// ═══════════ 液态玻璃实现 ═══════════

class _LiquidGlassBar extends StatelessWidget {
  const _LiquidGlassBar({
    required this.tabs,
    required this.currentIndex,
    required this.onTap,
  });

  final List<AdaptiveTab> tabs;
  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return CupertinoLiquidGlassBottomBar(
      currentIndex: currentIndex,
      onTap: onTap,
      theme: dark ? LiquidGlassThemeData.dark() : LiquidGlassThemeData.light(),
      activeColor: DsBrandColors.brand,
      items: [
        for (final tab in tabs)
          LiquidGlassBottomBarItem(
            icon: tab.icon,
            activeIcon: tab.activeIcon,
            label: tab.label,
          ),
      ],
    );
  }
}

// ═══════════ TDesign 降级实现 ═══════════

class _TdFallbackBar extends StatelessWidget {
  const _TdFallbackBar({
    required this.tabs,
    required this.currentIndex,
    required this.onTap,
  });

  final List<AdaptiveTab> tabs;
  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final td = TDTheme.of(context);
    return TDBottomTabBar(
      TDBottomTabBarBasicType.iconText,
      componentType: TDBottomTabBarComponentType.normal,
      outlineType: TDBottomTabBarOutlineType.filled,
      currentIndex: currentIndex,
      indicatorAnimation: TDBottomTabBarIndicatorAnimation.elastic,
      backgroundColor: td.bgColorContainer,
      navigationTabs: [
        for (var i = 0; i < tabs.length; i++)
          TDBottomTabBarTabConfig(
            onTap: () => onTap(i),
            tabText: tabs[i].label,
            selectedIcon: Icon(
              tabs[i].activeIcon,
              size: 22,
              color: td.brandNormalColor,
            ),
            unselectedIcon: Icon(
              tabs[i].icon,
              size: 22,
              color: td.fontGyColor3,
            ),
          ),
      ],
    );
  }
}
