import 'package:flutter/material.dart';
import 'package:tdesign_flutter/tdesign_flutter.dart';

import 'app_theme.dart';

/// App 品牌色系（TDesign token 覆盖）
abstract class DsBrandColors {
  static const brand = Color(0xFF4A6CF7); // 主品牌色
  static const brandPressed = Color(0xFF3B5BE0); // 按下/深色模式主色
  static const brandLight = Color(0xFFEAEFFE); // 浅色底
  static const brandLightHover = Color(0xFFD9E3FD); // 浅色 hover
  static const brandFocus = Color(0xFFB9C9FB); // 聚焦/更浅
}

/// 基于 TDesign token 的 App 主题。
///
/// 结构：
/// - TDThemeData（light/dark 两套）注册进 ThemeData.extensions，
///   TDesign 组件内部通过 `TDTheme.of(context)` 自动取到品牌色；
/// - Material 侧的 colorScheme / appBar / navigationBar 等也从 TD token 派生；
/// - 保留 NeuColors（新拟态）扩展，色值改为从 TD token 派生。
abstract class DsTdTheme {
  /// 浅色 TD 主题（覆盖品牌色，其余用 TDesign 默认）
  static final TDThemeData lightData = _brandOverride(
    base: TDThemeData.defaultData(),
    name: 'dstk',
    brandNormal: DsBrandColors.brand,
  );

  /// 深色 TD 主题
  static final TDThemeData? _darkBase = TDThemeData.defaultData().dark;

  static final TDThemeData? darkData = _darkBase == null
      ? null
      : _brandOverride(
          base: _darkBase!,
          name: 'dstkDark',
          brandNormal: DsBrandColors.brandPressed,
        );

  /// 在默认主题上合并品牌色（_copyMap 为合并语义，只覆盖传入 key）
  static TDThemeData _brandOverride({
    required TDThemeData base,
    required String name,
    required Color brandNormal,
  }) {
    return base.copyWithTDThemeData(name, colorMap: {
      'brandColor7': brandNormal,
      'brandColor8': DsBrandColors.brandPressed,
      'brandColor1': DsBrandColors.brandLight,
      'brandColor2': DsBrandColors.brandLightHover,
      'brandColor3': DsBrandColors.brandFocus,
    });
  }

  /// 构建 MaterialApp 用的 ThemeData（亮/暗）
  static ThemeData light() => _build(lightData, dark: false);

  static ThemeData dark() => _build(darkData ?? lightData, dark: true);

  static ThemeData _build(TDThemeData td, {required bool dark}) {
    final neu = _neuColors(td, dark: dark);
    final scheme = ColorScheme.fromSeed(
      seedColor: td.brandNormalColor,
      brightness: dark ? Brightness.dark : Brightness.light,
    ).copyWith(
      primary: td.brandNormalColor,
      secondary: td.brandNormalColor,
      surface: td.bgColorContainer,
      error: td.errorColor6,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: td.bgColorPage,
      extensions: [td, neu],
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: td.fontGyColor1,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          color: td.fontGyColor1,
          fontSize: 17,
          fontWeight: FontWeight.w600,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: td.bgColorContainer,
        indicatorColor: td.brandNormalColor.withValues(alpha: 0.15),
        elevation: 0,
        labelTextStyle: WidgetStatePropertyAll(
          TextStyle(fontSize: 11, color: td.fontGyColor2),
        ),
      ),
      dividerColor: td.componentStrokeColor,
      // TDesign 风格圆角
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: td.brandNormalColor,
          foregroundColor: td.whiteColor1,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(td.radiusRound),
          ),
        ),
      ),
    );
  }

  /// 从 TD token 派生新拟态色板（供既有卡片组件继续使用）
  static NeuColors _neuColors(TDThemeData td, {required bool dark}) {
    if (dark) {
      return NeuColors(
        background: td.bgColorPage,
        surface: td.bgColorContainer,
        textPrimary: td.fontGyColor1,
        textSecondary: td.fontGyColor2,
        shadowDark: const Color(0xCC10141C),
        shadowLight: const Color(0x333C465C),
      );
    }
    return NeuColors(
      background: td.bgColorPage,
      surface: td.bgColorContainer,
      textPrimary: td.fontGyColor1,
      textSecondary: td.fontGyColor2,
      shadowDark: const Color(0x59A3B1C6),
      shadowLight: const Color(0xE6FFFFFF),
    );
  }
}
