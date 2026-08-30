import 'dart:io' show Platform;

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 液态玻璃效果能力检测。
///
/// cupertino_liquid_glass 基于纯 Dart（BackdropFilter + CustomPainter），
/// 不存在"硬性不支持"的平台，但低端设备上实时高斯模糊会掉帧。
/// 策略：
/// - Android：API >= 31（Android 12，Impeller/新 GPU 驱动普及）→ 支持
/// - iOS：    系统版本 >= 16 → 支持
/// - 桌面/Web：→ 支持
/// - 检测失败：→ 降级（TDesign 原生底栏）
bool _cachedResult = false;
bool _checked = false;

Future<bool> detectGlassSupport() async {
  if (_checked) return _cachedResult;
  try {
    final plugin = DeviceInfoPlugin();
    if (!kIsWeb && Platform.isAndroid) {
      final info = await plugin.androidInfo;
      _cachedResult = info.version.sdkInt >= 31;
    } else if (!kIsWeb && Platform.isIOS) {
      final info = await plugin.iosInfo;
      final major =
          int.tryParse(info.systemVersion.split('.').first) ?? 0;
      _cachedResult = major >= 16;
    } else {
      _cachedResult = true;
    }
  } catch (_) {
    _cachedResult = false; // 任何异常 → 稳妥降级
  }
  _checked = true;
  return _cachedResult;
}

/// 底栏是否启用液态玻璃（AsyncValue：检测完成前默认走 TDesign 底栏，避免闪烁猜测）
final glassCapabilityProvider = FutureProvider<bool>((ref) async {
  return detectGlassSupport();
});
